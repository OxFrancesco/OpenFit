import SwiftUI

// SwiftUI port of activity-rings.tsx + rings-graphic.tsx (spec §4.1).
// Three heart loops with sweep gradient, track, head cap and multi-lap wrap.

struct RingSlot {
    var metricId: String
    var value: Double?
    var goal: Double
}

struct ActivityRingsView: View {
    var slots: [RingSlot]
    var days: Int = 1
    var onEditSlot: (Int) -> Void

    @Environment(\.colorScheme) private var colorScheme
    @State private var animatedProgress: [Double] = [0, 0, 0]

    private var colors: [Color] { RingSlotColors.colors(for: colorScheme) }

    private func progress(for slot: RingSlot) -> Double {
        guard let value = slot.value, slot.goal > 0 else { return 0 }
        return value / (slot.goal * Double(days))
    }

    var body: some View {
        HStack(alignment: .center, spacing: Spacing.three) {
            ringsGraphic
            legend
        }
        .frame(maxWidth: .infinity)
        .onAppear { animate() }
        .onChange(of: slots.map(\.metricId)) { animate() }
        .onChange(of: slots.map { $0.value ?? -1 }) { animate() }
        .onChange(of: days) { animate() }
    }

    private func animate() {
        animatedProgress = [0, 0, 0]
        for i in slots.indices {
            let target = progress(for: slots[i])
            withAnimation(.easeOut(duration: 1.1).delay(Double(i) * 0.15)) {
                animatedProgress[i] = target
            }
        }
    }

    // MARK: Rings graphic

    private var ringsGraphic: some View {
        ZStack {
            ForEach(slots.indices, id: \.self) { i in
                let loop = RingsGeometry.makeHeartGeometry(ringIndex: i)
                let path = RingsGeometry.path(for: loop)
                let p = i < animatedProgress.count ? animatedProgress[i] : 0
                let lap = RingsGeometry.lapFraction(p)
                let headTint = RingsGeometry.lighten(colors[i], amount: 0.42)
                let lapTint = RingsGeometry.lighten(colors[i], amount: 0.65)

                ZStack {
                    // Track
                    path.stroke(colors[i].opacity(0.22),
                                style: StrokeStyle(lineWidth: RingsGeometry.stroke, lineCap: .round, lineJoin: .round))
                    // Completed lap underneath once the goal is passed
                    if p >= 1 {
                        path.stroke(
                            AngularGradient(colors: [colors[i], headTint], center: .center),
                            style: StrokeStyle(lineWidth: RingsGeometry.stroke, lineJoin: .round))
                    }
                    // Current lap (brightens toward the head)
                    path.trim(from: 0, to: max(lap, 0.0001))
                        .stroke(
                            AngularGradient(
                                colors: p >= 1 ? [headTint, lapTint] : [colors[i], headTint],
                                center: .center),
                            style: StrokeStyle(lineWidth: RingsGeometry.stroke, lineCap: .round, lineJoin: .round))
                        .opacity(p > 0.001 ? 1 : 0)
                        .shadow(color: .black.opacity(0.3), radius: 2, y: 2)
                    // Head cap
                    if p > 0.001 {
                        Circle()
                            .fill(p >= 1 ? lapTint : headTint)
                            .frame(width: RingsGeometry.stroke, height: RingsGeometry.stroke)
                            .position(RingsGeometry.sample(loop, lap))
                            .shadow(color: .black.opacity(0.4), radius: 2, y: 1)
                    }
                }
            }
        }
        .frame(width: RingsGeometry.size, height: RingsGeometry.size)
    }

    // MARK: Legend

    private var legend: some View {
        VStack(alignment: .leading, spacing: Spacing.three) {
            ForEach(slots.indices, id: \.self) { i in
                let slot = slots[i]
                let def = MetricCatalog.def(for: slot.metricId)
                Button {
                    onEditSlot(i)
                } label: {
                    VStack(alignment: .leading, spacing: Spacing.half) {
                        Text(def?.legendLabel ?? slot.metricId)
                            .themed(.caption, color: Theme.textSecondary)
                        HStack(alignment: .lastTextBaseline, spacing: 2) {
                            Text(formatAmount(slot.value, fractionDigits: def?.fractionDigits ?? 0))
                                .font(.system(size: 18, weight: .semibold).monospacedDigit())
                                .foregroundStyle(colorScheme == .dark ? Theme.text : colors[i])
                            Text("/\(formatAmount(slot.goal * Double(days), fractionDigits: def?.fractionDigits ?? 0))")
                                .themed(.small, color: Theme.textSecondary)
                        }
                    }
                }
                .buttonStyle(.plain)
                .accessibilityLabel("\(def?.label ?? slot.metricId) ring. Change metric or goal")
            }
        }
    }
}

// MARK: - Ring editor sheet (spec §4.1)

struct RingEditorSheet: View {
    var slots: [RingSlot]
    var editingSlot: Int
    var onEditSlot: (Int?) -> Void
    var onSelectMetric: (Int, String) -> Void
    var onChangeGoal: (String, Double) -> Void

    @Environment(\.colorScheme) private var colorScheme
    private var colors: [Color] { RingSlotColors.colors(for: colorScheme) }

    private var editing: RingSlot? { slots[safe: editingSlot] }
    private var editingDef: MetricDef? { editing.flatMap { MetricCatalog.def(for: $0.metricId) } }
    private var usedElsewhere: Set<String> {
        Set(slots.indices.filter { $0 != editingSlot }.map { slots[$0].metricId })
    }

    var body: some View {
        VStack(spacing: Spacing.two) {
            HStack {
                HStack(spacing: Spacing.two) {
                    ForEach(slots.indices, id: \.self) { i in
                        Button { onEditSlot(i) } label: {
                            Circle()
                                .fill(colors[i])
                                .frame(width: 16, height: 16)
                                .opacity(i == editingSlot ? 1 : 0.3)
                        }
                        .accessibilityLabel("Edit ring \(i + 1)")
                    }
                }
                Spacer()
                Button("Done") { onEditSlot(nil) }
                    .themed(.smallBold)
            }
            .padding(.bottom, Spacing.one)

            if let editing, let editingDef {
                Text(editingDef.label).themed(.subtitle)
                    .frame(maxWidth: .infinity, alignment: .leading)

                // Goal stepper
                HStack {
                    stepper("−", disabled: editing.goal <= (editingDef.ring?.step ?? 1)) {
                        let step = editingDef.ring?.step ?? 1
                        onChangeGoal(editing.metricId, max(step, editing.goal - step))
                    }
                    VStack(spacing: Spacing.half) {
                        Text("Daily goal").themed(.caption, color: Theme.textSecondary)
                        Text("\(formatAmount(editing.goal, fractionDigits: editingDef.fractionDigits)) \(editingDef.unit)")
                            .themed(.smallBold)
                    }
                    stepper("+", disabled: false) {
                        onChangeGoal(editing.metricId, editing.goal + (editingDef.ring?.step ?? 1))
                    }
                }
                .padding(Spacing.one)
                .background(Theme.backgroundSelected)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))

                ScrollView {
                    LazyVStack(spacing: 0) {
                        ForEach(MetricCatalog.ringEligible.filter {
                            MetricCatalog.supports($0.id) && !usedElsewhere.contains($0.id)
                        }) { def in
                            let selected = def.id == editing.metricId
                            Button {
                                onSelectMetric(editingSlot, def.id)
                            } label: {
                                HStack(spacing: Spacing.three) {
                                    Image(systemName: def.icon)
                                        .font(.system(size: 18))
                                        .foregroundStyle(selected ? colors[editingSlot] : Theme.textSecondary)
                                        .frame(width: 22)
                                    VStack(alignment: .leading, spacing: Spacing.half) {
                                        Text(def.label)
                                            .themed(.default)
                                            .fontWeight(selected ? .semibold : .regular)
                                        Text(def.unit).themed(.small, color: Theme.textSecondary)
                                    }
                                    Spacer()
                                    if selected {
                                        Text("✓").themed(.default, color: colors[editingSlot])
                                    }
                                }
                                .padding(.vertical, Spacing.two)
                                .padding(.horizontal, Spacing.three)
                                .background(selected ? Theme.backgroundSelected : .clear)
                                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
        }
        .padding(Spacing.three)
        .frame(maxWidth: 360)
        .background(Theme.card)
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .padding(Spacing.four)
    }

    private func stepper(_ label: String, disabled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label).themed(.subtitle)
                .frame(width: 40, height: 40)
                .background(Theme.card)
                .clipShape(Circle())
        }
        .disabled(disabled)
        .opacity(disabled ? 0.4 : 1)
        .buttonStyle(.plain)
    }
}
