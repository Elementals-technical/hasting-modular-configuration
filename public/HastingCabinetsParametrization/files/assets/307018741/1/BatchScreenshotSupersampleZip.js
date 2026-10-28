var BatchScreenshotSupersampleZip = pc.createScript('batchScreenshotSupersampleZip');

// --- Attributes ---
BatchScreenshotSupersampleZip.attributes.add('entitiesToCapture', { type: 'entity', array: true, title: 'Entities to Screenshot' });
BatchScreenshotSupersampleZip.attributes.add('cameraEntity', { type: 'entity', title: 'Camera for Screenshot' });
BatchScreenshotSupersampleZip.attributes.add('width', { type: 'number', default: 1080 });
BatchScreenshotSupersampleZip.attributes.add('height', { type: 'number', default: 1080 });
BatchScreenshotSupersampleZip.attributes.add('format', { type: 'string', default: 'jpg', title: 'jpg or png' });
BatchScreenshotSupersampleZip.attributes.add('supersample', { type: 'number', default: 2, title: 'Supersampling multiplier' });
BatchScreenshotSupersampleZip.attributes.add('delay', { type: 'number', default: 0.5, title: 'Delay between shots (sec)' });

// --- Initialize ---
BatchScreenshotSupersampleZip.prototype.initialize = function() {
    var self = this;

    if (!this.cameraEntity || !this.cameraEntity.camera) {
        console.error("Camera Entity не задано або не має Camera Component!");
        return;
    }
    this.camera = this.cameraEntity.camera;
    this.currentIndex = 0;

    // всі entity на старті вимкнені
    for (var i = 0; i < this.entitiesToCapture.length; i++) {
        this.entitiesToCapture[i].enabled = false;
    }

    // --- Підключення JSZip через CDN ---
    if (!window.JSZip) {
        var jszipScript = document.createElement('script');
        jszipScript.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.0/jszip.min.js";
        jszipScript.onload = function() {
            self.createUI();
        };
        document.head.appendChild(jszipScript);
    } else {
        self.createUI();
    }
};

// --- Створюємо кнопки і прогресбар ---
BatchScreenshotSupersampleZip.prototype.createUI = function() {
    var self = this;

    function createButton(text, top, callback) {
        var btn = document.createElement('button');
        btn.innerHTML = text;
        btn.style.position = "fixed";
        btn.style.top = top + "px";
        btn.style.left = "20px";
        btn.style.padding = "10px 16px";
        btn.style.fontSize = "14px";
        btn.style.background = "#ff8c00";
        btn.style.color = "#fff";
        btn.style.border = "none";
        btn.style.borderRadius = "6px";
        btn.style.cursor = "pointer";
        btn.style.zIndex = "9999";
        document.body.appendChild(btn);
        btn.addEventListener('click', callback);
        return btn;
    }

    // --- Прогресбар ---
    this.progressContainer = document.createElement('div');
    this.progressContainer.style.position = 'fixed';
    this.progressContainer.style.top = '100px';
    this.progressContainer.style.left = '20px';
    this.progressContainer.style.width = '300px';
    this.progressContainer.style.height = '24px';
    this.progressContainer.style.background = '#333';
    this.progressContainer.style.borderRadius = '6px';
    this.progressContainer.style.overflow = 'hidden';
    this.progressContainer.style.zIndex = '9999';
    document.body.appendChild(this.progressContainer);

    this.progressBar = document.createElement('div');
    this.progressBar.style.width = '0%';
    this.progressBar.style.height = '100%';
    this.progressBar.style.background = '#00ccff';
    this.progressContainer.appendChild(this.progressBar);

    this.progressLabel = document.createElement('div');
    this.progressLabel.style.position = 'absolute';
    this.progressLabel.style.width = '100%';
    this.progressLabel.style.textAlign = 'center';
    this.progressLabel.style.color = '#fff';
    this.progressLabel.style.fontSize = '14px';
    this.progressLabel.style.top = '0';
    this.progressContainer.appendChild(this.progressLabel);

    // --- Кнопки ---
    createButton("Start Batch Screenshot", 20, function() {
        self.zip = new JSZip();
        self.currentIndex = 0;
        self.captureNext();
    });

    createButton("Single Screenshot", 60, function() {
        var enabledEntities = self.entitiesToCapture.filter(e => e.enabled);
        if (enabledEntities.length === 0) {
            alert("Немає увімкнених Entity для скріншоту!");
            return;
        }
        enabledEntities.forEach(function(entity) {
            self.takeScreenshot(entity.name).then(function(dataURL) {
                var link = document.createElement("a");
                link.href = dataURL;
                link.download = entity.name + "." + self.format;
                link.click();
            });
        });
    });
};

// --- Основний цикл батч-скріншотів ---
BatchScreenshotSupersampleZip.prototype.captureNext = function() {
    if (this.currentIndex >= this.entitiesToCapture.length) {
        this.progressBar.style.width = '100%';
        this.progressLabel.innerHTML = "Completed!";
        // Генеруємо ZIP
        this.zip.generateAsync({type:"blob"}).then(function(content) {
            var link = document.createElement("a");
            link.href = URL.createObjectURL(content);
            link.download = "batch_screenshots.zip";
            link.click();
        });
        return;
    }

    // Вимикаємо всі
    for (var i = 0; i < this.entitiesToCapture.length; i++) {
        this.entitiesToCapture[i].enabled = false;
    }

    var entity = this.entitiesToCapture[this.currentIndex];
    entity.enabled = true;

    // Оновлюємо прогресбар
    var progressPercent = Math.round((this.currentIndex / this.entitiesToCapture.length) * 100);
    this.progressBar.style.width = progressPercent + '%';
    this.progressLabel.innerHTML = "Rendering: " + entity.name + " (" + (this.currentIndex+1) + "/" + this.entitiesToCapture.length + ")";

    var self = this;
    setTimeout(function() {
        self.takeScreenshot(entity.name).then(function(dataURL) {
            var imgData = dataURL.split(",")[1]; // base64
            self.zip.file(entity.name + "." + self.format, imgData, {base64: true});
            self.currentIndex++;
            self.captureNext();
        });
    }, self.delay * 1000);
};

// --- Скріна через supersampling ---
BatchScreenshotSupersampleZip.prototype.takeScreenshot = function(filename) {
    return new Promise(function(resolve) {
        var cam = this.camera;
        var device = this.app.graphicsDevice;
        var width = this.width * this.supersample;
        var height = this.height * this.supersample;

        var texture = new pc.Texture(device, {width: width, height: height, format: pc.PIXELFORMAT_R8_G8_B8_A8});
        var renderTarget = new pc.RenderTarget({colorBuffer: texture, depth: true});
        var oldTarget = cam.renderTarget;
        cam.renderTarget = renderTarget;

        this.app.renderNextFrame = true;

        this.app.once("postrender", function() {
            var pixels = new Uint8Array(width * height * 4);
            device.readPixels(0, 0, width, height, pixels);

            var canvas = document.createElement("canvas");
            canvas.width = this.width;
            canvas.height = this.height;
            var ctx = canvas.getContext("2d");

            var tmpCanvas = document.createElement("canvas");
            tmpCanvas.width = width;
            tmpCanvas.height = height;
            var tmpCtx = tmpCanvas.getContext("2d");
            var imageData = tmpCtx.createImageData(width, height);

            for (var y = 0; y < height; y++) {
                for (var x = 0; x < width; x++) {
                    var src = ((height - y - 1) * width + x) * 4;
                    var dst = (y * width + x) * 4;
                    imageData.data[dst] = pixels[src];
                    imageData.data[dst+1] = pixels[src+1];
                    imageData.data[dst+2] = pixels[src+2];
                    imageData.data[dst+3] = pixels[src+3];
                }
            }

            tmpCtx.putImageData(imageData, 0, 0);
            ctx.drawImage(tmpCanvas, 0, 0, this.width, this.height);

            cam.renderTarget = oldTarget;
            renderTarget.destroy();
            texture.destroy();

            resolve(canvas.toDataURL(this.format === "png" ? "image/png" : "image/jpeg", 0.95));
        }.bind(this));
    }.bind(this));
};