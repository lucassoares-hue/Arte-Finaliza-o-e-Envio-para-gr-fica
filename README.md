# SGGE-PCP | Entregas e Produtividade

Aplicação web (HTML, CSS e JavaScript puros) do setor PCP do Sistema GGE de Ensino para acompanhar entregas e produtividade da produção editorial.

## Estrutura

```
index.html
css/style.css        estilos base e identidade visual
css/responsive.css   ajustes de layout por breakpoint
js/config.js         configurações (URL da API)
js/api.js            integração com a API JSON (Google Apps Script, aba BD-DADOS-ARTE)
js/filtros.js        estado dos filtros
js/indicadores.js    renderização de indicadores
js/graficos.js       renderização de gráficos
js/utils.js          funções utilitárias
js/app.js            inicialização, menu lateral e navegação
assets/              imagens e recursos estáticos
```

## Configuração da API

A URL da API será fornecida posteriormente. Quando disponível, preencher `API_URL` em `js/config.js`.

## Execução

Abrir `index.html` no navegador ou servir a pasta com qualquer servidor estático.
