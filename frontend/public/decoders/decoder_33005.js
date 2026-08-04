// JPEG-2000 decoder worker — offline edition
// Original: https://github.com/episphere/imagebox3/blob/main/decoders/decoder_33005.js
// Modified: CDN imports replaced with local /decoders/ paths for offline use.

importScripts("/decoders/openjpegwasm.js");
importScripts("/decoders/geotiff.js");

let decoder = {};
OpenJPEGWASM({
  locateFile: function (path, _scriptDirectory) {
    return "/decoders/" + path;
  },
}).then(function (openjpegWASM) {
  decoder = new openjpegWASM.J2KDecoder();
});

GeoTIFF.addDecoder([33003, 33005], async function () {
  return class JPEG2000Decoder extends GeoTIFF.BaseDecoder {
    constructor(fileDirectory) {
      super();
    }
    decodeBlock(b) {
      var encodedBuffer = decoder.getEncodedBuffer(b.byteLength);
      encodedBuffer.set(new Uint8Array(b));
      decoder.decode();
      var decodedBuffer = decoder.getDecodedBuffer();
      return decodedBuffer.buffer;
    }
  };
});

self.addEventListener("message", async function (e) {
  var id = e.data.id;
  var fileDirectory = e.data.fileDirectory;
  var buffer = e.data.buffer;
  var dec = await GeoTIFF.getDecoder(fileDirectory);
  var decoded = await dec.decode(fileDirectory, buffer);
  self.postMessage({ decoded: decoded, id: id }, [decoded]);
});
