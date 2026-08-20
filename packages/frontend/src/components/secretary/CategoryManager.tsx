import { useEffect, useState, type FormEvent, type CSSProperties } from 'react';
import { isAxiosError } from 'axios';
import api from '../../services/api';
import type { Category } from '../../types';

const styles: Record<string, CSSProperties> = {
   panel: { display: 'grid', gap: 18, color: '#17212b', fontFamily: 'system-ui, sans-serif' },
  heading: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' },
  title: { margin: 0, fontFamily: 'Georgia, serif', fontWeight: 500, fontSize: '1.65rem' },
  subtitle: { margin: '5px 0 0', color: '#61716e', fontSize: '.9rem' },
   form: { display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' },
  field: { display: 'grid', gap: 5, flex: '1 1 240px' },
  label: { fontSize: '.82rem', fontWeight: 700, color: '#384b47' },
  input: { boxSizing: 'border-box', width: '100%', border: '1px solid #cbd8d3', borderRadius: 8, padding: '10px 11px', font: 'inherit' },
   button: { border: 0, borderRadius: 8, padding: '10px 14px', marginTop: 24, background: '#174f47', color: '#fff', font: 'inherit', fontWeight: 700, cursor: 'pointer' },
  secondary: { border: '1px solid #cbd8d3', borderRadius: 7, padding: '7px 10px', background: '#fff', color: '#285a51', font: 'inherit', cursor: 'pointer' },
  list: { display: 'grid', gap: 8, margin: 0, padding: 0, listStyle: 'none' },
  item: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', border: '1px solid #e0e9e5', borderRadius: 9, padding: '11px 13px' },
  actions: { display: 'flex', gap: 7 },
  message: { margin: 0, padding: '10px 12px', borderRadius: 8, background: '#fff0f0', color: '#a32929', fontSize: '.88rem' },
  muted: { margin: 0, color: '#758581', fontSize: '.9rem' },
};

function errorMessage(error: unknown): string {
  if (!isAxiosError(error)) return 'Não foi possível concluir a operação. Tente novamente.';
  const data = error.response?.data as { error?: string; message?: string } | undefined;
  if (data?.error === 'CATEGORY_NAME_EXISTS' || error.response?.status === 409) return 'Já existe uma categoria com esse nome.';
  if (data?.error === 'INVALID_CATEGORY_NAME' || error.response?.status === 400) return data?.message ?? 'Informe um nome entre 1 e 50 caracteres.';
  return data?.message ?? 'Não foi possível concluir a operação. Tente novamente.';
}

interface CategoryManagerProps {
  onCategoriesChange?: (categories: Category[]) => void;
  refreshKey?: number;
}

export default function CategoryManager({ onCategoriesChange, refreshKey = 0 }: CategoryManagerProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);

  const load = async () => {
    if (categories.length === 0) setLoading(true);
    try { const { data } = await api.get<Category[]>('/categories'); setCategories(data); onCategoriesChange?.(data); } catch (cause) { setError(errorMessage(cause)); } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [refreshKey]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const value = name.trim();
    if (!value || value.length > 50) { setError('Informe um nome entre 1 e 50 caracteres.'); return; }
    setBusy(true); setError(null);
    try {
      const response = editing ? await api.put<Category>(`/categories/${editing.id}`, { name: value }) : await api.post<Category>('/categories', { name: value });
       setCategories((current) => {
         const next = editing ? current.map((item) => item.id === response.data.id ? response.data : item) : [...current, response.data];
         onCategoriesChange?.(next);
         return next;
       });
      setName(''); setEditing(null);
    } catch (cause) { setError(errorMessage(cause)); } finally { setBusy(false); }
  };

  const remove = async (category: Category) => {
    if (!window.confirm(`Excluir a categoria "${category.displayName}"?`)) return;
    setBusy(true); setError(null);
     try { await api.delete(`/categories/${category.id}`); setCategories((current) => { const next = current.filter((item) => item.id !== category.id); onCategoriesChange?.(next); return next; }); } catch (cause) { setError(errorMessage(cause)); } finally { setBusy(false); }
  };

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= categories.length) return;
    const next = [...categories];
    [next[index], next[target]] = [next[target], next[index]];
    setBusy(true);
    setMovingId(next[target].id);
    setError(null);
    try {
      const response = await api.patch<Category[]>('/categories/order', { categoryIds: next.map((item) => item.id) });
      setCategories(response.data);
      onCategoriesChange?.(response.data);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
      window.setTimeout(() => setMovingId(null), 450);
    }
  };

  return <section style={styles.panel} aria-labelledby="category-manager-title">
     <div style={styles.heading}><div><h2 id="category-manager-title" style={styles.title}>Categorias</h2><p style={styles.subtitle}>Organize os avisos por assunto.</p></div><button className="secretary-refresh-button" type="button" onClick={() => void load()} disabled={loading || busy}>{loading ? 'Carregando...' : 'Atualizar'}</button></div>
    {error && <p style={styles.message} role="alert">{error}</p>}
    <form style={styles.form} onSubmit={(event) => void submit(event)} noValidate><div style={styles.field}><label style={styles.label} htmlFor="category-name">{editing ? 'Editar categoria' : 'Nova categoria'}</label><input id="category-name" style={styles.input} value={name} onChange={(event) => setName(event.target.value)} maxLength={50} required aria-describedby="category-name-help" /><small id="category-name-help" style={styles.muted}>1 a 50 caracteres</small></div><button style={styles.button} type="submit" disabled={busy}>{busy ? 'Salvando...' : editing ? 'Salvar' : 'Adicionar'}</button>{editing && <button style={styles.secondary} type="button" onClick={() => { setEditing(null); setName(''); }}>Cancelar</button>}</form>
     <p style={styles.muted}>A ordem abaixo define as colunas no painel do Pastor.</p>
     {loading ? <p style={styles.muted}>Carregando categorias...</p> : categories.length === 0 ? <p style={styles.muted}>Nenhuma categoria cadastrada.</p> : <ul style={styles.list}>{categories.map((category, index) => <li className={movingId === category.id ? 'secretary-category-item-moving' : undefined} style={styles.item} key={category.id}><strong><span className="secretary-category-order">{index + 1}</span>{category.displayName}</strong><div style={styles.actions}><button style={styles.secondary} type="button" onClick={() => void move(index, -1)} disabled={busy || index === 0} aria-label={`Mover ${category.displayName} para cima`}>Subir</button><button style={styles.secondary} type="button" onClick={() => void move(index, 1)} disabled={busy || index === categories.length - 1} aria-label={`Mover ${category.displayName} para baixo`}>Descer</button><button style={styles.secondary} type="button" onClick={() => { setEditing(category); setName(category.displayName); }} disabled={busy}>Editar</button><button style={{ ...styles.secondary, color: '#a32929' }} type="button" onClick={() => void remove(category)} disabled={busy}>Excluir</button></div></li>)}</ul>}
  </section>;
}
