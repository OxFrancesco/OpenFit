import Foundation
import CoreGraphics
import SwiftUI

// Port of src/components/rings-geometry.ts (spec §4.1).
// Three concentric heart loops; the innermost is the base heart and the
// outer rings wrap around it, offset outward by STROKE+GAP per step.

enum RingsGeometry {
    static let size: CGFloat = 176
    static let stroke: CGFloat = 11
    static let gap: CGFloat = 5
    static let center: CGFloat = size / 2
    static let radii: [CGFloat] = [
        (size - stroke) / 2 - 6,
        (size - stroke) / 2 - 6 - (stroke + gap),
        (size - stroke) / 2 - 6 - 2 * (stroke + gap),
    ] // [76.5, 60.5, 44.5]

    private static let roundness = 0.3
    private static let notchDepth = 4.0
    private static let notchSpread = 1.0
    private static let rawSteps = 720

    struct Loop {
        var points: [CGPoint]      // equal arc-length spacing, starts at top notch
        var tangents: [CGPoint]    // unit tangents along direction of travel
        var perimeter: CGFloat
    }

    /// Classic parametric heart (16·sin³t), flipped into screen coordinates,
    /// blended toward a circle with a deepened top notch.
    private static func rawHeartPoint(_ t: Double) -> CGPoint {
        let hx = 16 * pow(sin(t), 3)
        let hy = -(13 * cos(t) - 5 * cos(2 * t) - 2 * cos(3 * t) - cos(4 * t))
        let cx = 14 * sin(t)
        let cy = 2.5 - 14 * cos(t)
        // Distance from the notch (t = 0), wrapped
        let dt = abs(fmod(t + .pi, 2 * .pi) - .pi)
        let dip = dt < notchSpread ? notchDepth * pow(cos(.pi * dt / (2 * notchSpread)), 2) : 0
        return CGPoint(
            x: (1 - roundness) * hx + roundness * cx,
            y: (1 - roundness) * hy + roundness * cy + dip
        )
    }

    /// Dense heart loop spanning 2·radius at its widest, vertically centered.
    private static func traceHeart(radius: CGFloat) -> [CGPoint] {
        var raw: [CGPoint] = []
        var minY = Double.infinity, maxY = -Double.infinity, maxX = 0.0
        for i in 0..<rawSteps {
            let p = rawHeartPoint(Double(i) / Double(rawSteps) * 2 * .pi)
            raw.append(p)
            minY = min(minY, p.y)
            maxY = max(maxY, p.y)
            maxX = max(maxX, abs(p.x))
        }
        let scale = radius / maxX
        let offsetY = center - ((minY + maxY) / 2) * scale
        return raw.map { CGPoint(x: center + $0.x * scale, y: offsetY + $0.y * scale) }
    }

    private static func distToSegmentSq(_ p: CGPoint, _ a: CGPoint, _ b: CGPoint) -> CGFloat {
        let abx = b.x - a.x, aby = b.y - a.y
        let t = max(0, min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / (abx * abx + aby * aby == 0 ? 1 : abx * abx + aby * aby)))
        let dx = p.x - (a.x + abx * t)
        let dy = p.y - (a.y + aby * t)
        return dx * dx + dy * dy
    }

    private static func minDistToLoop(_ p: CGPoint, _ loop: [CGPoint]) -> CGFloat {
        var best = CGFloat.infinity
        for i in 0..<loop.count {
            best = min(best, distToSegmentSq(p, loop[i], loop[(i + 1) % loop.count]))
        }
        return best.squareRoot()
    }

    private static func loopWidth(_ loop: [CGPoint]) -> CGFloat {
        (loop.map(\.x).max() ?? 0) - (loop.map(\.x).min() ?? 0)
    }

    /// Offset a closed loop outward by `d` along outward normals; culls points
    /// that land closer than d (softening the notch like a true dilation).
    private static func outsetLoop(_ loop: [CGPoint], _ d: CGFloat) -> [CGPoint] {
        let n = loop.count
        func offsetBy(_ sign: CGFloat) -> [CGPoint] {
            (0..<n).map { i in
                let prev = loop[(i - 1 + n) % n]
                let next = loop[(i + 1) % n]
                let dx = next.x - prev.x
                let dy = next.y - prev.y
                let len = max((dx * dx + dy * dy).squareRoot(), .ulpOfOne)
                return CGPoint(x: loop[i].x + sign * (dy / len) * d,
                               y: loop[i].y - sign * (dx / len) * d)
            }
        }
        var offset = offsetBy(1)
        if loopWidth(offset) < loopWidth(loop) {
            offset = offsetBy(-1)
        }
        return smoothLoop(offset.filter { minDistToLoop($0, loop) >= d - 0.5 })
    }

    /// Moving-average smoothing (2 iterations, window 7).
    private static func smoothLoop(_ loop: [CGPoint], iterations: Int = 2, window: Int = 7) -> [CGPoint] {
        let half = window / 2
        var pts = loop
        for _ in 0..<iterations {
            let n = pts.count
            let prev = pts
            pts = (0..<n).map { i in
                var sx: CGFloat = 0, sy: CGFloat = 0
                for k in -half...half {
                    let p = prev[(i + k + n) % n]
                    sx += p.x
                    sy += p.y
                }
                return CGPoint(x: sx / CGFloat(window), y: sy / CGFloat(window))
            }
        }
        return pts
    }

    /// Resample a closed loop at equal arc-length steps.
    private static func resampleLoop(_ loop: [CGPoint], samples: Int) -> Loop {
        let m = loop.count
        var cumulative: [CGFloat] = [0]
        for i in 1...m {
            let a = loop[i - 1]
            let b = loop[i % m]
            cumulative.append(cumulative[i - 1] + hypot(b.x - a.x, b.y - a.y))
        }
        let perimeter = cumulative[m]

        var points: [CGPoint] = []
        var seg = 0
        for i in 0..<samples {
            let target = CGFloat(i) / CGFloat(samples) * perimeter
            while cumulative[seg + 1] < target { seg += 1 }
            let span = cumulative[seg + 1] - cumulative[seg]
            let f = span > 0 ? (target - cumulative[seg]) / span : 0
            let a = loop[seg]
            let b = loop[(seg + 1) % m]
            points.append(CGPoint(x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f))
        }

        let tangents = (0..<samples).map { i -> CGPoint in
            let next = points[(i + 1) % samples]
            let prev = points[(i - 1 + samples) % samples]
            let dx = next.x - prev.x
            let dy = next.y - prev.y
            let len = max(hypot(dx, dy), .ulpOfOne)
            return CGPoint(x: dx / len, y: dy / len)
        }

        return Loop(points: points, tangents: tangents, perimeter: perimeter)
    }

    private static var cache: [Int: Loop] = [:]

    /// Heart loop for one ring (0 = outermost).
    static func makeHeartGeometry(ringIndex: Int, samples: Int = 240) -> Loop {
        if let cached = cache[ringIndex] { return cached }
        let base = traceHeart(radius: radii[radii.count - 1])
        let growth = CGFloat(radii.count - 1 - ringIndex) * (stroke + gap)
        let loop = growth == 0 ? base : outsetLoop(base, growth)
        let result = resampleLoop(loop, samples: samples)
        cache[ringIndex] = result
        return result
    }

    /// Path through the resampled loop points, closed.
    static func path(for loop: Loop) -> Path {
        var path = Path()
        guard let first = loop.points.first else { return path }
        path.move(to: first)
        for p in loop.points.dropFirst() { path.addLine(to: p) }
        path.closeSubpath()
        return path
    }

    /// Fraction of the current lap (0..1) for possibly multi-lap progress.
    static func lapFraction(_ p: Double) -> Double {
        p >= 1 ? p - p.rounded(.down) : min(max(p, 0), 1)
    }

    /// Point at fraction `f` of the perimeter (for the head cap).
    static func sample(_ loop: Loop, _ f: Double) -> CGPoint {
        let n = loop.points.count
        let idx = min(max(f, 0), 1) * Double(n)
        let i0 = Int(idx) % n
        let i1 = (i0 + 1) % n
        let frac = CGFloat(idx - floor(idx))
        let a = loop.points[i0]
        let b = loop.points[i1]
        return CGPoint(x: a.x + (b.x - a.x) * frac, y: a.y + (b.y - a.y) * frac)
    }

    /// Mix a hex color toward white (amount 0..1).
    static func lighten(_ color: Color, amount: Double) -> Color {
        let ui = UIColor(color)
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        ui.getRed(&r, green: &g, blue: &b, alpha: &a)
        let c = { (x: CGFloat) in x + (1 - x) * amount }
        return Color(red: c(r), green: c(g), blue: c(b))
    }
}

// MARK: - Slot colors (spec §4.1)

struct RingSlotColors {
    static let light = [Color(hex: "#007D60"), Color(hex: "#C45735"), Color(hex: "#687A26")]
    static let dark = [Color(hex: "#45BC94"), Color(hex: "#F38D6F"), Color(hex: "#AEC35A")]

    static func colors(for scheme: ColorScheme) -> [Color] {
        scheme == .dark ? dark : light
    }
}
