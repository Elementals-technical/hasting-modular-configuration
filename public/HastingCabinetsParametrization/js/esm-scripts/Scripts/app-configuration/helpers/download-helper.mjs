/**
 * @class DownloadHelper
 * @classdesc Helper utility for creating and downloading files in the browser
 */ class DownloadHelper {
    /**
     * Creates a Blob and triggers a browser download
     * @param {ArrayBuffer|String} data - File data (binary or text)
     * @param {string} filename - Name of the file to download
     * @param {string} mimeType - MIME type of the file
     */ static download(data, filename, mimeType) {
        try {
            const blob = new Blob([
                data
            ], {
                type: mimeType
            });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = filename;
            anchor.style.display = 'none';
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
            setTimeout(()=>{
                URL.revokeObjectURL(url);
            }, 1000);
            return true;
        } catch (error) {
            console.error('[DownloadHelper] Download failed:', error);
            return false;
        }
    }
    /**
     * Downloads a GLB file
     * @param {ArrayBuffer} glbData - GLB binary data
     * @param {string} [filename] - Custom filename (default: composition_{timestamp}.glb)
     */ static downloadGLB(glbData, filename = null) {
        const defaultFilename = `composition_${Date.now()}.glb`;
        return this.download(glbData, filename || defaultFilename, 'model/gltf-binary');
    }
    /**
     * Downloads a USD file
     * @param {string} usdText - USD text data (USDA format)
     * @param {string} [filename] - Custom filename (default: composition_{timestamp}.usda)
     */ static downloadUSD(usdText, filename = null) {
        const defaultFilename = `composition_${Date.now()}.usda`;
        return this.download(usdText, filename || defaultFilename, 'model/vnd.usd+zip');
    }
    /**
     * Downloads both GLB and USD files
     * @param {ArrayBuffer} glbData - GLB binary data
     * @param {string} usdText - USD text data
     * @param {string} [baseFilename] - Base filename without extension
     */ static downloadBoth(glbData, usdText, baseFilename = null) {
        const timestamp = Date.now();
        const baseName = baseFilename || `composition_${timestamp}`;
        const glbSuccess = this.downloadGLB(glbData, `${baseName}.glb`);
        const usdSuccess = this.downloadUSD(usdText, `${baseName}.usda`);
        return {
            glb: glbSuccess,
            usd: usdSuccess
        };
    }
    /**
     * Creates a Blob from data without downloading
     * @param {ArrayBuffer|String} data - File data
     * @param {string} mimeType - MIME type
     * @returns {Blob} Blob object
     */ static createBlob(data, mimeType) {
        return new Blob([
            data
        ], {
            type: mimeType
        });
    }
    /**
     * Creates an object URL from a Blob
     * @param {Blob} blob - Blob object
     * @returns {string} Object URL
     */ static createObjectURL(blob) {
        return URL.createObjectURL(blob);
    }
    /**
     * Revokes an object URL
     * @param {string} url - Object URL to revoke
     */ static revokeObjectURL(url) {
        URL.revokeObjectURL(url);
    }
}

export { DownloadHelper };
