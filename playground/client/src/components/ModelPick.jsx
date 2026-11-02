import { LOCAL_MODELS } from '../../../../src/ai/providers/localModels';

export { LOCAL_MODELS };

export const setupCommands = (model) => `git clone https://github.com/Maayank18/FloatGPT.git
cd FloatGPT
${model.pull}
npm install`;

export const ModelPick = ({ index, onChange }) => {
  const model = LOCAL_MODELS[index] || LOCAL_MODELS[0];
  return (
    <div className="mt-4">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <p className="text-[13px] font-medium text-text-primary">{model.name} {model.detail}</p>
        <p className="text-right text-[11px] text-text-muted">{model.download} · {model.memory}</p>
      </div>
      <input
        type="range"
        min={0}
        max={LOCAL_MODELS.length - 1}
        step={1}
        value={index}
        aria-label="Open model"
        aria-valuetext={`${model.name} ${model.detail}`}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ accentColor: 'var(--color-text-primary)' }}
        className="h-2 w-full cursor-pointer"
      />
      <div className="mt-2 flex justify-between text-[10px] text-text-muted">
        {LOCAL_MODELS.map((item, itemIndex) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(itemIndex)}
            className={itemIndex === index ? 'font-semibold text-text-primary' : 'hover:text-text-secondary'}
          >
            {item.name}
          </button>
        ))}
      </div>
    </div>
  );
};
