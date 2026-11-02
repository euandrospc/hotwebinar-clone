import { publicSaleNotificationDto, type PublicSaleNotification } from "./public-dto";

const names = [
  "Tiago", "Mateus", "Luiza", "Ana", "Rafael", "Beatriz", "Gustavo", "Mariana", "Pedro", "Clara",
  "Bruno", "Camila", "Lucas", "Isabela", "Felipe", "Laura", "André", "Sofia", "Diego", "Júlia",
  "Henrique", "Alice", "Daniel", "Lívia", "Caio", "Renata", "Rodrigo", "Gabriela", "Vinícius", "Carolina",
  "Leonardo", "Helena", "Marcelo", "Bianca", "Eduardo", "Letícia", "Samuel", "Vitória", "Fernando", "Natália",
  "Arthur", "Aline", "Guilherme", "Amanda", "Ricardo", "Débora", "Gabriel", "Fernanda", "João", "Manuela"
];

const cities = [
  "Belo Horizonte", "Recife", "São Paulo", "Curitiba", "Fortaleza", "Campinas",
  "Salvador", "Goiânia", "Angra dos Reis", "Manaus", "Porto Alegre", "Brasília",
  "Maceió", "Florianópolis", "Niterói", "João Pessoa", "Campo Grande", "Natal",
  "Vitória", "Rio de Janeiro", "Belém", "Cuiabá", "Sorocaba", "São Luís",
  "Joinville", "Teresina", "Santos", "Aracaju", "Ribeirão Preto", "Juiz de Fora",
  "Palmas", "Uberlândia", "Londrina", "Porto Velho", "Feira de Santana", "Macapá",
  "Pelotas", "Boa Vista", "São José dos Campos", "Caruaru", "Rio Branco", "Blumenau",
  "Campina Grande", "Santarém", "Marília", "Ilhéus"
];

const localPositions = new Set([1, 12, 19, 33, 44]);

function cityKey(city: string) {
  const key = city.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return key === "sp" ? "sao paulo" : key;
}

export function resolveScheduledSales(rows: PublicSaleNotification[], viewerCity: string | null) {
  const city = viewerCity?.trim();
  const otherCities = cities.filter(candidate => cityKey(candidate) !== cityKey(city ?? ""));
  let otherIndex = 0;
  let index = 0;
  return rows.map(row => {
    const notification = publicSaleNotificationDto(row);
    if (!notification.buyerName.includes("{comprador}")) return notification;
    const position = index++ % names.length;
    const name = names[position];
    const origin = city && localPositions.has(position) ? city : otherCities[otherIndex++ % otherCities.length];
    const buyerName = notification.buyerName.replaceAll("{comprador}", () => name)
      .replaceAll("{origem}", () => `, de ${origin},`);
    return { ...notification, buyerName, simulated: true };
  });
}
