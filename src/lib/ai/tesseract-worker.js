'use strict'

/**
 * Custom Tesseract.js Node worker that forces the non-SIMD LSTM core.
 *
 * The default worker auto-detects relaxed SIMD support, but the
 * relaxedsimd WASM binary crashes with a missing DotProductSSE symbol
 * in Next.js's Node.js runtime. This worker hardcodes the plain LSTM
 * core to bypass the broken detection.
 */
const { parentPort } = require('worker_threads')
const worker = require('tesseract.js/src/worker-script')
const gunzip = require('tesseract.js/src/worker-script/node/gunzip')
const cache = require('tesseract.js/src/worker-script/node/cache')

const fetch = globalThis.fetch || require('node-fetch')

let TesseractCore = null

async function getCore(_oem, _corePath, res) {
  if (TesseractCore === null) {
    res.progress({ status: 'loading tesseract core', progress: 0 })
    TesseractCore = require('tesseract.js-core/tesseract-core-lstm')
    res.progress({ status: 'loading tesseract core', progress: 1 })
  }
  return TesseractCore
}

parentPort.on('message', (packet) => {
  worker.dispatchHandlers(packet, (obj) => parentPort.postMessage(obj))
})

worker.setAdapter({
  getCore,
  gunzip,
  fetch,
  ...cache,
})
