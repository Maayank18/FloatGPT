/** Open models the on-PC path can run. Sizes are the Ollama library figures. */
export const LOCAL_MODELS = [
  {
    id: 'qwen2.5-coder:7b',
    name: 'Qwen',
    detail: '2.5 Coder 7B',
    pull: 'ollama pull qwen2.5-coder:7b',
    download: '4.7 GB',
    memory: '8 GB of memory can run it',
  },
  {
    id: 'deepseek-r1:8b',
    name: 'DeepSeek',
    detail: 'R1 8B',
    pull: 'ollama pull deepseek-r1:8b',
    download: '5.2 GB',
    memory: '16 GB of memory is the comfortable size',
  },
  {
    id: 'gpt-oss:20b',
    name: 'GPT-OSS',
    detail: '20B',
    pull: 'ollama pull gpt-oss:20b',
    download: '14 GB',
    memory: '16 GB of memory is the minimum Ollama names for this one',
  },
  {
    id: 'kimi-k2.6:cloud',
    name: 'Kimi',
    detail: 'K2.6',
    pull: 'ollama pull kimi-k2.6:cloud',
    download: 'Cloud',
    memory: 'Ollama runs this in the cloud. It is not stored on this PC',
  },
] as const;

export const LOCAL_MODEL_ID = LOCAL_MODELS[0].id;

export function localModelChoice(id?: string) {
  return LOCAL_MODELS.find((model) => model.id === id) || LOCAL_MODELS[0];
}
