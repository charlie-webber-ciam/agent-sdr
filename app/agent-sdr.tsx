import { Agent, webSearchTool, fileSearchTool } from '@openai/agents';

const agent = new Agent({
  name: 'Auth0 SDR',
  tools: [webSearchTool(), fileSearchTool('VS_ID')],
});

