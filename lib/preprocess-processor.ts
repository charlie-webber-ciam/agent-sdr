/**
 * Preprocessing Processor
 *
 * Processes large batches of accounts for validation and cleaning.
 * Outputs a cleaned CSV file ready for main research agent.
 */

import pLimit from 'p-limit';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { stringify } from 'csv-stringify/sync';
import {
  getPreprocessingJob,
  updatePreprocessingJobStatus,
  updatePreprocessingJobProgress,
  createPreprocessingResult,
  getValidPreprocessingResults,
  findDuplicateDomains,
} from './db';
import { validateCompany, isDuplicateDomain, CompanyInput } from './preprocess-agent';
import { PROCESSING_CONFIG } from './config';

interface CompanyToValidate extends CompanyInput {
  index: number;
}

const activeJobs = new Set<number>();

/**
 * Process preprocessing job with parallel validation
 */
export async function processPreprocessingJob(
  jobId: number,
  companies: CompanyInput[],
  concurrency: number = Math.min(PROCESSING_CONFIG.concurrency, 10) // Max 10 for preprocessing
): Promise<void> {
  if (activeJobs.has(jobId)) {
    console.log(`Preprocessing job ${jobId} is already being processed`);
    return;
  }

  activeJobs.add(jobId);

  try {
    const job = getPreprocessingJob(jobId);
    if (!job) {
      throw new Error(`Preprocessing job ${jobId} not found`);
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔍 Starting PREPROCESSING for job ${jobId}`);
    console.log(`   Total companies: ${companies.length}`);
    console.log(`   Concurrency: ${concurrency}`);
    console.log(`${'='.repeat(60)}\n`);

    updatePreprocessingJobStatus(jobId, 'processing');

    // Get existing domains from database to detect duplicates
    const allDomains = companies.map(c => c.domain).filter(Boolean) as string[];
    const existingDomains = findDuplicateDomains(allDomains);
    const seenDomains = new Set<string>();

    let processedCount = 0;
    let removedCount = 0;
    let failedCount = 0;

    // Create concurrency limiter
    const limit = pLimit(concurrency);

    // Process in batches
    const batchSize = concurrency * 2;
    for (let i = 0; i < companies.length; i += batchSize) {
      // Check if job is paused
      const currentJob = getPreprocessingJob(jobId);
      if (currentJob?.paused === 1) {
        console.log(`\n⏸️  Job ${jobId} is paused. Waiting...`);
        await new Promise(resolve => setTimeout(resolve, 3000)); // Check every 3 seconds
        i -= batchSize; // Stay at same batch
        continue;
      }

      // Check if job was cancelled
      if (currentJob?.status === 'failed') {
        console.log(`\n❌ Job ${jobId} was cancelled`);
        break;
      }

      const batch = companies.slice(i, i + batchSize);

      console.log(`\n📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(companies.length / batchSize)} (${batch.length} companies)...`);

      // Update current company
      if (batch.length > 0) {
        updatePreprocessingJobStatus(jobId, 'processing', batch[0].company_name);
      }

      // Create validation promises
      const promises = batch.map((company, batchIndex) =>
        limit(async () => {
          const companyIndex = i + batchIndex;
          console.log(`[${companyIndex + 1}/${companies.length}] Validating: ${company.company_name}`);

          try {
            // Validate company
            const validation = await validateCompany(company);

            // Check for duplicates
            const isDuplicate = isDuplicateDomain(
              validation.validated_domain,
              seenDomains,
              existingDomains
            );

            // Add to seen domains if valid
            if (validation.validated_domain && !isDuplicate) {
              seenDomains.add(validation.validated_domain.toLowerCase().trim());
            }

            // Determine if should include
            const shouldInclude = validation.is_active && !isDuplicate;

            // Store result
            createPreprocessingResult({
              job_id: jobId,
              original_company_name: company.company_name,
              original_domain: company.domain || null,
              original_industry: company.industry,
              validated_company_name: validation.validated_company_name,
              validated_domain: validation.validated_domain,
              is_duplicate: isDuplicate,
              is_active: validation.is_active,
              should_include: shouldInclude,
              validation_notes: validation.validation_notes,
            });

            if (!shouldInclude) {
              removedCount++;
              console.log(
                `[${companyIndex + 1}/${companies.length}] ✗ ${company.company_name} - ${isDuplicate ? 'DUPLICATE' : 'INACTIVE'}`
              );
            } else {
              console.log(`[${companyIndex + 1}/${companies.length}] ✓ ${validation.validated_company_name}`);
            }

            processedCount++;
            return { success: true };
          } catch (error) {
            console.error(`[${companyIndex + 1}/${companies.length}] Failed to validate ${company.company_name}:`, error);

            // Store failed result
            createPreprocessingResult({
              job_id: jobId,
              original_company_name: company.company_name,
              original_domain: company.domain || null,
              original_industry: company.industry,
              should_include: false,
              validation_notes: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            });

            failedCount++;
            removedCount++;
            processedCount++;
            return { success: false };
          }
        })
      );

      // Wait for batch to complete
      await Promise.allSettled(promises);

      // Update progress
      updatePreprocessingJobProgress(jobId, processedCount, removedCount, failedCount);

      console.log(
        `📊 Progress: ${processedCount}/${companies.length} processed, ${removedCount} removed, ${failedCount} failed`
      );

      // Small delay between batches
      if (i + batchSize < companies.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Generate CSV file
    console.log('\n📄 Generating cleaned CSV file...');
    const outputFilename = await generateCleanedCSV(jobId);

    // Mark job as completed
    updatePreprocessingJobStatus(jobId, 'completed', null, outputFilename);

    const validCount = processedCount - removedCount;
    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ Preprocessing job ${jobId} completed`);
    console.log(`   Total processed: ${processedCount}`);
    console.log(`   Valid accounts: ${validCount}`);
    console.log(`   Removed: ${removedCount} (${((removedCount / processedCount) * 100).toFixed(1)}%)`);
    console.log(`   Failed: ${failedCount}`);
    console.log(`   Output file: ${outputFilename}`);
    console.log(`${'='.repeat(60)}\n`);
  } catch (error) {
    console.error(`\n❌ Preprocessing job ${jobId} failed:`, error);
    updatePreprocessingJobStatus(jobId, 'failed');
    throw error;
  } finally {
    activeJobs.delete(jobId);
  }
}

/**
 * Generate CSV file from valid results
 */
async function generateCleanedCSV(jobId: number): Promise<string> {
  const validResults = getValidPreprocessingResults(jobId);

  // Convert to CSV format (company_name, domain, industry)
  const csvData = validResults.map(result => ({
    company_name: result.validated_company_name || result.original_company_name,
    domain: result.validated_domain || '',
    industry: result.original_industry,
  }));

  // Generate CSV string
  const csvString = stringify(csvData, {
    header: true,
    columns: ['company_name', 'domain', 'industry'],
  });

  // Save to file
  const timestamp = Date.now();
  const filename = `cleaned_accounts_${jobId}_${timestamp}.csv`;
  const filepath = join(process.cwd(), 'data', 'preprocessed', filename);

  // Ensure directory exists
  const { mkdirSync, existsSync } = require('fs');
  const dirPath = join(process.cwd(), 'data', 'preprocessed');
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }

  writeFileSync(filepath, csvString);

  console.log(`✓ CSV file generated: ${filename}`);
  console.log(`  Valid accounts: ${validResults.length}`);

  return filename;
}
