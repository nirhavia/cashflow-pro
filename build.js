
const babel = require('@babel/core');
const fs    = require('fs');

const jsx    = fs.readFileSync('app.jsx',        'utf8');
const hBefore = fs.readFileSync('html_before.txt','utf8');
const hAfter  = fs.readFileSync('html_after.txt', 'utf8');

const result = babel.transformSync(jsx, {
  presets: ['@babel/preset-react'],
  filename: 'app.jsx'
});

let code = result.code;

// הסר export default
code = code.replace(/^export default /gm, '');

// mount + error display
code += `

try {
  ReactDOM.createRoot(document.getElementById('root'))
    .render(React.createElement(App, null));
} catch(e) {
  document.getElementById('root').innerHTML =
    '<div style="color:#e05454;padding:40px;font-family:monospace;background:#0c1018;min-height:100vh">' +
    '<b>Error:</b><br>' + e.message + '</div>';
}
`;

const final = hBefore + '<script>\n' + code + '\n<\/script>' + hAfter;
fs.writeFileSync('index.html', final);
console.log('OK:' + final.length);
