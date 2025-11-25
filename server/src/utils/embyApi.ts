import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const EMBY_SERVER_URL = process.env.EMBY_SERVER_URL;
const EMBY_API_KEY = process.env.EMBY_API_KEY;

if (!EMBY_SERVER_URL || !EMBY_API_KEY) {
  console.error('EMBY_SERVER_URL or EMBY_API_KEY is not defined in .env');
  process.exit(1);
}

const embyApi = axios.create({
  baseURL: EMBY_SERVER_URL,
  headers: {
    'X-Emby-Token': EMBY_API_KEY,
    'Content-Type': 'application/json',
  },
});

export default embyApi;
