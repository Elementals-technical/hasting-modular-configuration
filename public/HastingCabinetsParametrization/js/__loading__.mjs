import { Asset, script } from './playcanvas-stable.min.mjs';

// ==========================================
// 1. ЧАСТЬ LOCAL BRIDGE
// ==========================================
(function() {
    var LOCAL_PORT = 3000;
    var isLocal = window.location.search.includes('local=true');
    if (!isLocal) return;
    console.log('%c🔧 MODE: LOCAL DEV (Aggressive Hook)', 'background: #222; color: #bada55');
    var LOCAL_ROOT = 'https://localhost:' + LOCAL_PORT;
    var fileMap = null;
    try {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', LOCAL_ROOT + '/file-map', false);
        xhr.send(null);
        if (xhr.status === 200) {
            fileMap = JSON.parse(xhr.responseText);
            console.log('🗺️ File map loaded:', Object.keys(fileMap).length, 'files');
        }
    } catch (e) {
        console.error('❌ Localhost hook failed to load map', e);
        return;
    }
    if (fileMap && Asset && Asset.prototype) {
        var originalGetFileUrl = Asset.prototype.getFileUrl;
        Asset.prototype.getFileUrl = function() {
            var file = this.file;
            if (file && file.filename && fileMap[file.filename]) {
                return LOCAL_ROOT + '/src/' + fileMap[file.filename] + '?t=' + Date.now();
            }
            return originalGetFileUrl.call(this);
        };
        console.log('✅ Asset system patched (ALL types)');
    }
})();
// ==========================================
// 2. ОРИГИНАЛЬНЫЙ КОД ЗАГРУЗЧИКА
// ==========================================
script.createLoadingScreen(function(app) {
    var showSplash = function() {
        // spinner
        var wrapper = document.createElement('div');
        wrapper.id = 'application-spinner';
        document.body.appendChild(wrapper);
        // wrap
        var splash = document.createElement('div');
        splash.id = 'application-wrap';
        wrapper.appendChild(splash);
        // splash.style.display = 'none';
        // svg
        var svg = document.createElement('div');
        svg.id = 'application-svg';
        splash.appendChild(svg);
        var svgCode = `
            <svg
              viewBox="0 0 80 80"
              width="128"
              height="128"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M40.0003 6.66675V20.0001M54.0003 26.0001L63.667 16.3334M60.0003 40.0001H73.3337M54.0003 54.0001L63.667 63.6667M40.0003 60.0001V73.3334M16.3337 63.6667L26.0003 54.0001M6.66699 40.0001H20.0003M16.3337 16.3334L26.0003 26.0001"
                stroke="#FFFFFF"
                stroke-width="4"
                stroke-linecap="round"
                stroke-linejoin="round"
                fill="none"
              />
              <path
                d="M54 25.9999L63.6667 16.3333"
                stroke="#AC5331"
                stroke-width="4"
                stroke-linecap="round"
                stroke-linejoin="round"
                fill="none"
              />
            </svg>
        `;
        svg.innerHTML = svgCode;
    };
    var hideSplash = function() {
        var splash = document.getElementById('application-spinner');
        if (splash) {
            splash.parentElement.removeChild(splash);
        }
    };
    var createCss = function() {
        var css = [
            'body {',
            '    background-color: #f1efe9;',
            '}',
            '',
            '#application-spinner {',
            '    position: absolute;',
            '    top: 0;',
            '    left: 0;',
            '    height: 100%;',
            '    width: 100%;',
            '    background-color: #f1efe9;',
            '}',
            '',
            '#application-wrap {',
            '    position: absolute;',
            '    top: calc(50% - 28px);',
            '    width: 264px;',
            '    left: calc(50% - 132px);',
            '}',
            '',
            '#application-svg svg {',
            '    animation: spin 1s linear infinite;',
            '    transform-origin: center;',
            '}',
            '',
            '@-webkit-keyframes spin {',
            '    from {',
            '        transform: rotate(0deg);',
            '    }',
            '    to {',
            '        transform: rotate(360deg);',
            '    }',
            '}',
            '',
            '@keyframes spin {',
            '    from {',
            '        transform: rotate(0deg);',
            '    }',
            '    to {',
            '        transform: rotate(360deg);',
            '    }',
            '}'
        ].join('\n');
        var style = document.createElement('style');
        style.type = 'text/css';
        if (style.styleSheet) {
            style.styleSheet.cssText = css;
        } else {
            style.appendChild(document.createTextNode(css));
        }
        document.head.appendChild(style);
    };
    createCss();
    showSplash();
    app.on('preload:end', function() {
        app.off('preload:progress');
    });
    app.on('start', hideSplash);
});
