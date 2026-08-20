import { useEffect, useState, type FormEvent, type CSSProperties } from 'react';
import { isAxiosError } from 'axios';
import api from '../../services/api';
import type { Category, Template } from '../../types';

const styles: Record<string, CSSProperties> = {
  panel: { display: 'grid', gap: 18, color: '#17212b', fontFamily: 'system-ui, sans-serif' },
  heading: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' },
  title: { margin: 0, fontFamily: 'Georgia, serif', fontWeight: 500, fontSize: '1.65rem' },
  subtitle: { margin: '5px 0 0', color: '#61716e', fontSize: '.9rem' },
  form: { display: 'grid', gap: 9, border: '1px solid #e0e9e5', borderRadius: 10, padding: 14 },
  field: { display: 'grid', gap: 5 },
  label: { fontSize: '.82rem', fontWeight: 700, color: '#384b47' },
  input: { boxSizing: 'border-box', width: '100%', border: '1px solid #cbd8d3', borderRadius: 8, padding: '10px 11px', font: 'inherit' },
  textarea: { boxSizing: 'border-box', width: '100%', minHeight: 105, resize: 'vertical', border: '1px solid #cbd8d3', borderRadius: 8, padding: '10px 11px', font: 'inherit' },
  button: { border: 0, borderRadius: 8, padding: '10px 14px', background: '#174f47', color: '#fff', font: 'inherit', fontWeight: 700, cursor: 'pointer' },
  secondary: { border: '1px solid #cbd8d3', borderRadius: 7, padding: '7px 10px', background: '#fff', color: '#285a51', font: 'inherit', cursor: 'pointer' },
  list: { display: 'grid', gap: 8, margin: 0, padding: 0, listStyle: 'none' },
  item: { border: '1px solid #e0e9e5', borderRadius: 9, padding: '13px 14px' },
  itemTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  body: { whiteSpace: 'pre-wrap', margin: '8px 0 12px', color: '#61716e', fontSize: '.9rem' },
  actions: { display: 'flex', gap: 7 },
  badge: { borderRadius: 99, padding: '3px 8px', background: '#eaf7f1', color: '#24644f', fontSize: '.72rem', fontWeight: 700 },
  message: { margin: 0, padding: '10px 12px', borderRadius: 8, background: '#fff0f0', color: '#a32929', fontSize: '.88rem' },
  muted: { margin: 0, color: '#758581', fontSize: '.9rem' },
};

function errorMessage(error: unknown): string {
  if (!isAxiosError(error)) return 'Não foi possível concluir a operação. Tente novamente.';
  const data = error.response?.data as { error?: string; message?: string } | undefined;
  if (data?.error === 'BUSINESS_RULE_VIOLATION') return 'O template padrão não pode ser excluído.';
  if (data?.error === 'VALIDATION_ERROR' || error.response?.status === 400) return data?.message ?? 'Confira o título e o conteúdo informados.';
  return data?.message ?? 'Não foi possível concluir a operação. Tente novamente.';
}

interface TemplateManagerProps {
  onTemplatesChange?: (templates: Template[]) => void;
  refreshKey?: number;
}

export default function TemplateManager({ onTemplatesChange, refreshKey = 0 }: TemplateManagerProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [values, setValues] = useState({ title: '', body: '', categoryId: '' });
  const [editing, setEditing] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => { if (templates.length === 0 && categories.length === 0) setLoading(true); try { const [templateResponse, categoryResponse] = await Promise.all([api.get<Template[]>('/templates'), api.get<Category[]>('/categories')]); setTemplates(templateResponse.data); setCategories(categoryResponse.data); onTemplatesChange?.(templateResponse.data); } catch (cause) { setError(errorMessage(cause)); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, [refreshKey]);
  const reset = () => { setEditing(null); setValues({ title: '', body: '', categoryId: '' }); };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!values.title.trim() || values.title.length > 100 || !values.body.trim() || values.body.length > 500) { setError('O título deve ter 1–100 caracteres e o conteúdo, 1–500 caracteres.'); return; }
    setBusy(true); setError(null);
     try { const response = editing ? await api.put<Template>(`/templates/${editing.id}`, { ...values, categoryId: values.categoryId || null }) : await api.post<Template>('/templates', { ...values, categoryId: values.categoryId || undefined }); setTemplates((current) => { const next = editing ? current.map((item) => item.id === response.data.id ? response.data : item) : [...current, response.data]; onTemplatesChange?.(next); return next; }); reset(); } catch (cause) { setError(errorMessage(cause)); } finally { setBusy(false); }
  };
  const remove = async (template: Template) => {
    if (template.isDefault) { setError('O template padrão não pode ser excluído.'); return; }
    if (!window.confirm(`Excluir o template "${template.title}"?`)) return;
    setBusy(true); setError(null);
     try { await api.delete(`/templates/${template.id}`); setTemplates((current) => { const next = current.filter((item) => item.id !== template.id); onTemplatesChange?.(next); return next; }); } catch (cause) { setError(errorMessage(cause)); } finally { setBusy(false); }
  };
  return <section style={styles.panel} aria-labelledby="template-manager-title">
     <div style={styles.heading}><div><h2 id="template-manager-title" style={styles.title}>Templates</h2><p style={styles.subtitle}>Reutilize textos frequentes ao enviar avisos.</p></div><button className="secretary-refresh-button" type="button" onClick={() => void load()} disabled={loading || busy}>{loading ? 'Carregando...' : 'Atualizar'}</button></div>
    {error && <p style={styles.message} role="alert">{error}</p>}
     <form style={styles.form} onSubmit={(event) => void submit(event)} noValidate><div style={styles.field}><label style={styles.label} htmlFor="template-title">Título</label><input id="template-title" style={styles.input} value={values.title} maxLength={100} required onChange={(event) => setValues({ ...values, title: event.target.value })} /></div><div style={styles.field}><label style={styles.label} htmlFor="template-body">Conteúdo</label><textarea id="template-body" style={styles.textarea} value={values.body} maxLength={500} required onChange={(event) => setValues({ ...values, body: event.target.value })} /><small style={styles.muted}>{values.body.length}/500 caracteres</small></div><div style={styles.field}><label style={styles.label} htmlFor="template-category">Categoria automática</label><select id="template-category" style={styles.input} value={values.categoryId} onChange={(event) => setValues({ ...values, categoryId: event.target.value })}><option value="">Nenhuma</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.displayName}</option>)}</select></div><div style={styles.actions}><button style={styles.button} type="submit" disabled={busy}>{busy ? 'Salvando...' : editing ? 'Salvar' : 'Adicionar'}</button>{editing && <button style={styles.secondary} type="button" onClick={reset}>Cancelar</button>}</div></form>
     {loading ? <p style={styles.muted}>Carregando templates...</p> : templates.length === 0 ? <p style={styles.muted}>Nenhum template cadastrado.</p> : <ul style={styles.list}>{templates.map((template) => <li style={styles.item} key={template.id}><div style={styles.itemTop}><strong>{template.title}</strong>{template.isDefault && <span style={styles.badge}>Padrão</span>}</div><p style={styles.body}>{template.body}</p><small style={styles.muted}>Categoria: {template.category?.displayName ?? 'Nenhuma'}</small><div style={styles.actions}><button style={styles.secondary} type="button" onClick={() => { setEditing(template); setValues({ title: template.title, body: template.body, categoryId: template.categoryId ?? '' }); }} disabled={busy}>Editar</button><button style={{ ...styles.secondary, color: '#a32929' }} type="button" onClick={() => void remove(template)} disabled={busy || template.isDefault} aria-label={template.isDefault ? `${template.title}: template padrão não pode ser excluído` : `Excluir ${template.title}`}>Excluir</button></div></li>)}</ul>}
  </section>;
}
