interface SliderDef {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  format?: (v: number) => string;
}

export function createSliderGroup(
  title: string,
  color: string,
  defs: SliderDef[],
  container: HTMLElement,
  onChange: (key: string, value: number) => void,
  group?: string
): void {
  const fieldset = document.createElement('fieldset');
  fieldset.className = 'slider-group';
  fieldset.style.borderColor = color;

  const legend = document.createElement('legend');
  legend.textContent = title;
  legend.style.color = color;
  fieldset.appendChild(legend);

  for (const def of defs) {
    const row = document.createElement('div');
    row.className = 'slider-row';

    const labelEl = document.createElement('label');
    labelEl.textContent = def.label;

    const valSpan = document.createElement('span');
    valSpan.className = 'slider-value';
    const fmt = def.format ?? ((v: number) => v.toString());
    valSpan.textContent = fmt(def.value);

    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(def.min);
    input.max = String(def.max);
    input.step = String(def.step);
    input.value = String(def.value);
    input.dataset.defaultValue = String(def.value);
    if (group) {
      input.dataset.paramGroup = group;
      input.dataset.paramKey = def.key;
    }

    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      valSpan.textContent = fmt(v);
      onChange(def.key, v);
    });

    const labelRow = document.createElement('div');
    labelRow.className = 'label-row';
    labelRow.appendChild(labelEl);
    labelRow.appendChild(valSpan);

    row.appendChild(labelRow);
    row.appendChild(input);
    fieldset.appendChild(row);
  }

  container.appendChild(fieldset);
}
