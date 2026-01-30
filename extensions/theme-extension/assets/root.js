import{r as l,j as e}from"./index.js";import{a as j,b as g,c as w,d as S,_ as b,e as c,M as h,L as p,O as k,S as x,f as E,i as M}from"./components.js";/**
 * @remix-run/react v2.17.4
 *
 * Copyright (c) Remix Software Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.md file in the root directory of this source tree.
 *
 * @license MIT
 */let d="positions";function R({getKey:r,...s}){let{isSpaMode:t}=j(),i=g(),u=w();S({getKey:r,storageKey:d});let m=l.useMemo(()=>{if(!r)return null;let o=r(i,u);return o!==i.key?o:null},[]);if(t)return null;let f=((o,y)=>{if(!window.history.state||!window.history.state.key){let n=Math.random().toString(32).slice(2);window.history.replaceState({key:n},"")}try{let a=JSON.parse(sessionStorage.getItem(o)||"{}")[y||window.history.state.key];typeof a=="number"&&window.scrollTo(0,a)}catch(n){console.error(n),sessionStorage.removeItem(o)}}).toString();return l.createElement("script",b({},s,{suppressHydrationWarning:!0,dangerouslySetInnerHTML:{__html:`(${f})(${c(JSON.stringify(d))}, ${c(JSON.stringify(m))})`}}))}const v="/assets/tailwind.css",$=()=>[{rel:"stylesheet",href:"https://cdn.shopify.com/static/fonts/inter/v4/styles.css"},{rel:"stylesheet",href:v}];function H(){return e.jsxs("html",{lang:"en",children:[e.jsxs("head",{children:[e.jsx("meta",{charSet:"utf-8"}),e.jsx("meta",{name:"viewport",content:"width=device-width,initial-scale=1"}),e.jsx(h,{}),e.jsx(p,{})]}),e.jsxs("body",{children:[e.jsx(k,{}),e.jsx(R,{}),e.jsx(x,{})]})]})}function I(){const r=E();let s="Unknown error",t="";return M(r)?s=`${r.status} ${r.statusText} - ${r.data}`:r instanceof Error&&(s=r.message,t=r.stack||""),e.jsxs("html",{children:[e.jsxs("head",{children:[e.jsx("title",{children:"Application Error"}),e.jsx(h,{}),e.jsx(p,{}),e.jsx("style",{dangerouslySetInnerHTML:{__html:`
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 2rem; background: #fef2f2; color: #991b1b; }
          .container { max-width: 800px; margin: 0 auto; background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
          h1 { margin-top: 0; color: #b91c1c; }
          pre { background: #f3f4f6; padding: 1rem; border-radius: 4px; overflow-x: auto; color: #374151; font-size: 0.9rem; }
        `}})]}),e.jsxs("body",{children:[e.jsxs("div",{className:"container",children:[e.jsx("h1",{children:"Application Error"}),e.jsx("p",{children:"The application encountered an error while rendering."}),e.jsxs("p",{children:[e.jsx("strong",{children:"Error:"})," ",s]}),t&&e.jsxs("details",{children:[e.jsx("summary",{children:"View Stack Trace"}),e.jsx("pre",{children:t})]})]}),e.jsx(x,{})]})]})}export{I as ErrorBoundary,H as default,$ as links};
