const characterNames = [
  'adrian', 'astrid', 'aurora', 'cedric', 'conrad', 'damian', 'darius', 'edgar', 'gabriel', 'gregor', 'kuzgun', 'mireya', 'morgana', 'morwen', 'raphael', 'rowan', 'silas', 'tobias', 'tristan', 'valen', 'viktor', 'wilhelm'
];

export const AVATARS = characterNames.map(name => ({
  id: name,
  name: name.charAt(0).toUpperCase() + name.slice(1),
  src: `/assets/avatars/${name}.png`
}));
