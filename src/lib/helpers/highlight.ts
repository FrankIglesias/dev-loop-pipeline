function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function highlight(val: unknown, indent = 0): string {
  const pad = '  '.repeat(indent);
  const pad1 = '  '.repeat(indent + 1);

  if (val === null) return `<span class="jnull">null</span>`;
  if (typeof val === 'boolean') return `<span class="jb">${val}</span>`;
  if (typeof val === 'number') return `<span class="jn">${val}</span>`;
  if (typeof val === 'string') return `<span class="js">"${esc(val)}"</span>`;

  if (Array.isArray(val)) {
    if (val.length === 0) return `<span class="jp">[]</span>`;
    const items = val
      .map((v) => `${pad1}${highlight(v, indent + 1)}`)
      .join(`<span class="jp">,</span>\n`);
    return `<span class="jp">[</span>\n${items}\n${pad}<span class="jp">]</span>`;
  }

  if (typeof val === 'object' && val !== null) {
    const keys = Object.keys(val as Record<string, unknown>);
    if (keys.length === 0) return `<span class="jp">{}</span>`;
    const items = keys
      .map(
        (k) =>
          `${pad1}<span class="jk">"${esc(k)}"</span><span class="jp">: </span>${highlight((val as Record<string, unknown>)[k], indent + 1)}`
      )
      .join(`<span class="jp">,</span>\n`);
    return `<span class="jp">{</span>\n${items}\n${pad}<span class="jp">}</span>`;
  }

  return esc(String(val));
}
