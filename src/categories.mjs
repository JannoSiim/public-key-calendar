export const categories = [
  { id: 'cryptography', label: 'Cryptography', file: 'index.html', subtitle: 'Only essential conferences for public key cryptography' },
  { id: 'cybersec', label: 'Cybersec', file: 'cybersec.html', subtitle: 'Only essential conferences for public key cryptography' },
  { id: 'tcs', label: 'TCS', file: 'tcs.html', subtitle: 'Only essential conferences for public key cryptography' }
];

export function renderTabs(active) {
  return categories.map(category => `<a class="category-tab" href="./${category.file}"${category.id === active ? ' aria-current="page"' : ''}>${category.label}</a>`).join('');
}
