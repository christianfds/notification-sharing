import type { Template } from '../../types';

interface TemplateSelectorProps {
  templates: Template[];
  selectedTemplateId?: string;
  onSelect: (template: Template | undefined) => void;
  disabled?: boolean;
}

export default function TemplateSelector({
  templates,
  selectedTemplateId,
  onSelect,
  disabled = false,
}: TemplateSelectorProps) {
  return (
    <div className="secretary-template-selector">
      <label htmlFor="notification-template">Usar um modelo</label>
      <select
        id="notification-template"
        value={selectedTemplateId ?? ''}
        disabled={disabled || templates.length === 0}
        onChange={(event) => onSelect(templates.find((template) => template.id === event.target.value))}
      >
        <option value="">Começar do zero</option>
        {templates.map((template) => (
          <option key={template.id} value={template.id}>
            {template.title}{template.category ? ` · ${template.category.displayName}` : ''}{template.isDefault ? ' · padrão' : ''}
          </option>
        ))}
      </select>
      {templates.length === 0 && <small>Nenhum modelo disponível.</small>}
      <small>Selecione um modelo para preencher os campos. Você ainda pode editá-los.</small>
    </div>
  );
}
