const BASE_URL = "https://urban-goldfish-x6vrqrpj96wcp74j-8000.app.github.dev";

export const getMessages = () => {
  return fetch(`${BASE_URL}/api/messages/1/`).then(res => res.json());
};