/* Cliente do Apps Script. POST com texto puro evita preflight de CORS. */
(function () {
  'use strict';

  const CFG = window.TREINO_CONFIG;
  const TIMEOUT_MS = 15000;

  class ApiError extends Error {
    constructor(message) {
      super(message);
      this.name = 'ApiError';
      this.isAuth = /chave/i.test(message);
    }
  }

  async function call(body) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(CFG.API_URL, {
        method: 'POST',
        body: JSON.stringify(body),
        signal: ctrl.signal,
        redirect: 'follow',
      });
      if (!res.ok) throw new ApiError(`Planilha indisponível (HTTP ${res.status}).`);
      const data = await res.json();
      if (!data.ok) throw new ApiError(data.error || 'A planilha recusou a requisição.');
      return data;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(err.name === 'AbortError' ? 'A planilha demorou demais para responder.' : 'Sem conexão com a planilha.');
    } finally {
      clearTimeout(timer);
    }
  }

  window.Api = Object.freeze({
    isRemote: () => Boolean(CFG.API_URL),
    async list(key) {
      return (await call({ action: 'list', key })).records;
    },
    async save(key, record) {
      return (await call({ action: 'upsert', key, record })).record;
    },
  });
})();
