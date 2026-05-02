import axios from 'axios';

export async function login(baseUrl: string, username: string, password: string) {
  const { data } = await axios.post(`${baseUrl}/api/v1/auth/login`, { username, password });
  return data;
}
