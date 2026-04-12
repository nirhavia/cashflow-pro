
const babel = require('@babel/core');
const fs    = require('fs');

const jsx = fs.readFileSync('app.jsx', 'utf8');
const result = babel.transformSync(jsx, {
  presets: ['@babel/preset-react'],
  filename: 'app.jsx'
});

let code = result.code;

// הסר export default
code = code.replace(/^export default /gm, '');

// הוסף mount עם error display
code += `

// ── Mount ──
try {
  ReactDOM.createRoot(document.getElementById('root'))
    .render(React.createElement(App, null));
} catch(e) {
  document.getElementById('root').innerHTML =
    '<div style="color:#e05454;padding:40px;font-family:monospace;font-size:14px;background:#0c1018">' +
    '<b>JS Error:</b><br>' + e.message + '<br><pre>' + e.stack + '</pre></div>';
}
`;

const htmlBefore = Buffer.from(fs.readFileSync('html_before.b64','utf8').trim(),'base64').toString('utf8');
const htmlAfter  = Buffer.from(fs.readFileSync('html_after.b64', 'utf8').trim(),'base64').toString('utf8');

const final = htmlBefore + '<script>\n' + code + '\n<\/script>' + htmlAfter;
fs.writeFileSync('index.html', final);
console.log('✅ index.html built — ' + final.length + ' chars');
