/* Cliente do Apps Script. POST com texto puro evita preflight de CORS. */
(function () {
  "use strict";

  const CFG = window.TREINO_CONFIG;
  const TIMEOUT_MS = 15000;

  class ApiError extends Error {
    constructor(message) {
      super(message);
      this.name = "ApiError";
      this.isAuth = /chave/i.test(message);
    }
  }

  const MSG = {
    timeout: "A planilha demorou demais para responder.",
    offline: "Sem internet neste aparelho.",
    unreachable:
      'O navegador não conseguiu alcançar a planilha. Confira a URL em config.js (deve terminar em /exec) e se a implantação está com acesso para "Qualquer pessoa".',
    notJson:
      'A planilha respondeu algo que não é JSON, o que costuma ser a página de login do Google. Confira se a implantação está com acesso para "Qualquer pessoa" e se a URL termina em /exec.',
  };

  async function call(body) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      let res;
      try {
        res = await fetch(CFG.API_URL, {
          method: "POST",
          body: JSON.stringify(body),
          signal: ctrl.signal,
          redirect: "follow",
        });
      } catch (err) {
        console.error("[treino] falha de rede ao chamar a planilha:", err);
        if (err.name === "AbortError") throw new ApiError(MSG.timeout);
        throw new ApiError(
          navigator.onLine === false ? MSG.offline : MSG.unreachable,
        );
      }
      if (!res.ok)
        throw new ApiError(`Planilha indisponível (HTTP ${res.status}).`);
      let data;
      try {
        data = await res.json();
      } catch (err) {
        console.error(
          "[treino] resposta da planilha fora do formato JSON:",
          err,
        );
        throw new ApiError(
          err.name === "AbortError" ? MSG.timeout : MSG.notJson,
        );
      }
      if (!data || !data.ok)
        throw new ApiError(
          (data && data.error) || "A planilha recusou a requisição.",
        );
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  window.Api = Object.freeze({
    isRemote: () => Boolean(CFG.API_URL),
    async list(key) {
      return (await call({ action: "list", key })).records;
    },
    async save(key, record) {
      return (await call({ action: "upsert", key, record })).record;
    },
  });
})();
