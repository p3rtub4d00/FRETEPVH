export const emptyAddress = () => ({ street: '', number: '', noNumber: false, neighborhood: '', city: 'Porto Velho', state: 'RO', complement: '', reference: '' });
export const formatAddress = a => `${a.street.trim()}, ${a.noNumber ? 's/n' : a.number.trim()} - ${a.neighborhood.trim()}, ${a.city.trim()} - ${a.state}, Brasil`;
export function normalizeAddress(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Informe o endereço completo.');
  const result = {};
  for (const [key, min, max] of [['street',3,60],['neighborhood',2,40],['city',2,40],['complement',0,60],['reference',0,120]]) {
    const value = typeof input[key] === 'string' ? input[key].trim() : '';
    if (value.length < min || value.length > max) throw new Error('Confira rua, bairro, cidade, complemento e referência.');
    result[key] = value;
  }
  result.state = typeof input.state === 'string' ? input.state.trim().toUpperCase() : '';
  if (!['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].includes(result.state)) throw new Error('Selecione uma UF válida.');
  result.noNumber = input.noNumber === true;
  result.number = result.noNumber ? '' : (typeof input.number === 'string' ? input.number.trim() : '');
  if (!result.noNumber && (!result.number || result.number.length > 12)) throw new Error('Informe o número ou marque Sem número.');
  return result;
}
export function mapsRouteUrl(origin, destination) {
  return 'https://www.google.com/maps/dir/?' + new URLSearchParams({ api:'1', origin, destination, travelmode:'driving' }).toString();
}
