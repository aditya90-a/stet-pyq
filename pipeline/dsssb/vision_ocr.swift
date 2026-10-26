// Apple Vision OCR for the DSSSB pipeline (macOS only, no downloads needed).
// Usage: vision_ocr <image> [<image> ...]
// Prints one JSON object per image: {"file", "lines": [{"text", "conf", "box": [x, y, w, h]}]}
// Boxes are normalised (0..1) with the origin at the top-left. Language correction is off so that
// code, identifiers and symbols are reported as printed.
import AppKit
import Foundation
import Vision

func recognise(_ path: String) -> [String: Any] {
    guard let img = NSImage(contentsOfFile: path),
          let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil)
    else { return ["file": path, "error": "cannot read image", "lines": []] }
    let req = VNRecognizeTextRequest()
    req.recognitionLevel = .accurate
    req.usesLanguageCorrection = false
    req.recognitionLanguages = ["en-US"]
    let handler = VNImageRequestHandler(cgImage: cg, options: [:])
    do { try handler.perform([req]) } catch { return ["file": path, "error": "\(error)", "lines": []] }
    var lines: [[String: Any]] = []
    for obs in req.results ?? [] {
        guard let top = obs.topCandidates(1).first else { continue }
        let b = obs.boundingBox
        lines.append(["text": top.string, "conf": Double(top.confidence),
                      "box": [b.minX, 1 - b.maxY, b.width, b.height]])
    }
    // reading order: top to bottom, then left to right
    lines.sort { a, b in
        let ya = (a["box"] as! [CGFloat])[1], yb = (b["box"] as! [CGFloat])[1]
        if abs(ya - yb) > 0.01 { return ya < yb }
        return (a["box"] as! [CGFloat])[0] < (b["box"] as! [CGFloat])[0]
    }
    return ["file": path, "lines": lines]
}

for path in CommandLine.arguments.dropFirst() {
    let out = recognise(path)
    if let data = try? JSONSerialization.data(withJSONObject: out),
       let s = String(data: data, encoding: .utf8) { print(s) }
}
