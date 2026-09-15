import SwiftUI

// MARK: - MetricCard (spec §4.2)

struct MetricCardView: View {
    var def: MetricDef
    var metric: HealthMetric?
    var days: Int = 1

    @State private var page = 0

    private var daily: [MetricDay] { days > 1 ? (metric?.dailyValues ?? []) : [] }
    private var pageCount: Int { 1 + (daily.count > 1 ? daily.count : 0) }

    private func valueText(_ value: Double?) -> some View {
        HStack(alignment: .lastTextBaseline, spacing: Spacing.one) {
            Text(formatAmount(value, fractionDigits: def.fractionDigits)).themed(.metric)
            if def.unit.lowercased() != def.label.lowercased() {
                Text(def.unit).themed(.small, color: Theme.textSecondary)
            }
        }
    }

    private func dayDetail(_ day: MetricDay) -> String {
        let formatter = DateFormatter()
        formatter.locale = .current
        formatter.dateFormat = "yyyy-MM-dd"
        if let date = formatter.date(from: day.date) {
            let out = DateFormatter()
            out.dateFormat = "MMM d"
            return out.string(from: date)
        }
        return day.date
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.one) {
            HStack {
                Text(def.label).themed(.caption, color: Theme.textSecondary)
                Spacer()
                Image(systemName: def.icon)
                    .font(.system(size: 16))
                    .foregroundStyle(Theme.textSecondary)
            }
            Spacer(minLength: 0)
            HStack(alignment: .center, spacing: 4) {
                VStack(alignment: .leading, spacing: 4) {
                    if page == 0 {
                        valueText(metric?.value)
                        if daily.count > 1 {
                            Text("\(days)-day \(def.aggregate == .avg ? "average" : "total")")
                                .themed(.caption, color: Theme.textSecondary)
                                .lineLimit(2)
                        }
                    } else {
                        let day = daily[page - 1]
                        valueText(day.value)
                        Text(dayDetail(day)).themed(.caption, color: Theme.textSecondary).lineLimit(2)
                    }
                }
                Spacer(minLength: 0)
                if pageCount > 1 {
                    VStack {
                        pagerArrow("chevron.up", disabled: page == 0) { page -= 1 }
                        pagerArrow("chevron.down", disabled: page == pageCount - 1) { page += 1 }
                    }
                }
            }
            .frame(minHeight: 80)
            if metric?.status == .error, let error = metric?.error {
                Text(error).themed(.caption, color: Theme.error).lineLimit(1)
            }
        }
        .padding(Spacing.three)
        .frame(minWidth: 140, minHeight: metricCardMinHeight, alignment: .topLeading)
        .background(Theme.card)
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
    }

    private func pagerArrow(_ icon: String, disabled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 14))
                .foregroundStyle(Theme.textSecondary)
                .frame(width: 28, height: 36)
        }
        .disabled(disabled)
        .opacity(disabled ? 0.25 : 1)
        .buttonStyle(.plain)
    }
}

// MARK: - SleepCard (spec §4.3)

struct SleepCardView: View {
    var sessions: [SleepSummary]
    @State private var page = 0

    private func sleepDuration(_ session: SleepSummary) -> String {
        guard let raw = session.minutesAsleep ?? session.minutesInSleepPeriod else { return "--" }
        let minutes = Int(raw.rounded())
        return "\(minutes / 60)h \(minutes % 60)m"
    }

    private func endDetail(_ session: SleepSummary) -> String {
        guard let end = session.endTime else { return "" }
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = iso.date(from: end) else { return " · \(end)" }
        let out = DateFormatter()
        out.dateFormat = "MMM d, HH:mm"
        return " · \(out.string(from: date))"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.one) {
            Text("Sleep").themed(.caption, color: Theme.textSecondary)
            Spacer(minLength: 0)
            HStack(alignment: .center, spacing: 4) {
                VStack(alignment: .leading, spacing: 4) {
                    if sessions.isEmpty {
                        Text("--").themed(.metric)
                    } else {
                        let session = sessions[min(page, sessions.count - 1)]
                        Text(sleepDuration(session)).themed(.metric)
                        Text("\(session.kind == "nap" ? "Nap" : "Night")\(endDetail(session))")
                            .themed(.caption, color: Theme.textSecondary)
                            .lineLimit(2)
                    }
                }
                Spacer(minLength: 0)
                if sessions.count > 1 {
                    VStack {
                        Button { page -= 1 } label: {
                            Image(systemName: "chevron.up").font(.system(size: 14))
                                .foregroundStyle(Theme.textSecondary).frame(width: 28, height: 36)
                        }
                        .disabled(page == 0).opacity(page == 0 ? 0.25 : 1).buttonStyle(.plain)
                        Button { page += 1 } label: {
                            Image(systemName: "chevron.down").font(.system(size: 14))
                                .foregroundStyle(Theme.textSecondary).frame(width: 28, height: 36)
                        }
                        .disabled(page == sessions.count - 1)
                        .opacity(page == sessions.count - 1 ? 0.25 : 1).buttonStyle(.plain)
                    }
                }
            }
            .frame(minHeight: 80)
        }
        .padding(Spacing.three)
        .frame(minWidth: 140, minHeight: metricCardMinHeight, alignment: .topLeading)
        .background(Theme.card)
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
    }
}

// MARK: - CardEditor sheet (spec §4.4)

struct CardEditorSheet: View {
    @Binding var selected: [String]
    var onToggle: (String) -> Void
    var onClose: () -> Void

    struct Entry: Identifiable {
        var id: String
        var label: String
        var unit: String?
        var icon: String
        var category: MetricCategory
    }

    private var entries: [Entry] {
        MetricCatalog.all.filter { MetricCatalog.supports($0.id) }.map {
            Entry(id: $0.id, label: $0.label, unit: $0.unit, icon: $0.icon, category: $0.category)
        } + [Entry(id: MetricCatalog.sleepCardID, label: "Sleep", unit: nil,
                   icon: "bed.double.fill", category: .sleep)]
    }

    var body: some View {
        VStack(spacing: Spacing.two) {
            HStack(alignment: .top) {
                Text("Cards").themed(.subtitle)
                Spacer()
                Button("Done", action: onClose).frame(minHeight: 48)
            }
            .padding(.bottom, Spacing.one)

            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(MetricCatalog.categories, id: \.self) { category in
                        let group = entries.filter { $0.category == category }
                        if !group.isEmpty {
                            Text(category.rawValue)
                                .themed(.caption, color: Theme.textSecondary)
                                .tracking(0.5)
                                .padding(.vertical, Spacing.one)
                                .padding(.horizontal, Spacing.three)
                            ForEach(group) { entry in
                                let isOn = selected.contains(entry.id)
                                Button {
                                    onToggle(entry.id)
                                } label: {
                                    HStack(spacing: Spacing.three) {
                                        Image(systemName: entry.icon)
                                            .font(.system(size: 18))
                                            .foregroundStyle(isOn ? Theme.text : Theme.textSecondary)
                                            .frame(width: 22)
                                        VStack(alignment: .leading, spacing: Spacing.half) {
                                            Text(entry.label).themed(.default)
                                            if let unit = entry.unit {
                                                Text(unit).themed(.small, color: Theme.textSecondary)
                                            }
                                        }
                                        Spacer()
                                        Image(systemName: isOn ? "checkmark.square.fill" : "square")
                                            .foregroundStyle(isOn ? Theme.primary : Theme.textSecondary)
                                    }
                                    .frame(minHeight: 56)
                                    .padding(.vertical, Spacing.two)
                                    .padding(.horizontal, Spacing.three)
                                }
                                .buttonStyle(.plain)
                                .accessibilityLabel("\(entry.label), \(entry.unit ?? "")")
                                .accessibilityAddTraits(isOn ? .isSelected : [])
                            }
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
}

// MARK: - Shared small views

struct ErrorBanner: View {
    var message: String
    var title: String = "Error"

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.half) {
            Text(title).themed(.smallBold, color: Theme.error)
            Text(message).themed(.small, color: Theme.error)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, Spacing.three)
        .padding(.vertical, Spacing.two + Spacing.half)
        .background(Theme.errorBannerBackground)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }
}

struct SkeletonCard: View {
    @State private var pulsing = false

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.two) {
            RoundedRectangle(cornerRadius: 6, style: .continuous)
                .fill(Theme.backgroundSelected)
                .frame(width: 90, height: 12)
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(Theme.backgroundSelected)
                .frame(width: 115, height: 26)
        }
        .padding(Spacing.three)
        .frame(minWidth: 140, maxWidth: .infinity, minHeight: metricCardMinHeight, alignment: .topLeading)
        .background(Theme.card)
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .opacity(pulsing ? 0.85 : 0.45)
        .animation(.easeInOut(duration: 0.85).repeatForever(autoreverses: true), value: pulsing)
        .onAppear { pulsing = true }
    }
}

struct LoadingDots: View {
    var color: Color = Theme.textSecondary
    var size: CGFloat = 6
    @State private var animating = false

    var body: some View {
        HStack(spacing: Spacing.one) {
            ForEach(0..<3, id: \.self) { i in
                Circle()
                    .fill(color)
                    .frame(width: size, height: size)
                    .offset(y: animating ? -size / 2 : 0)
                    .opacity(animating ? 1 : 0.35)
                    .animation(
                        .easeInOut(duration: 0.36)
                            .repeatForever(autoreverses: true)
                            .delay(Double(i) * 0.16),
                        value: animating
                    )
            }
        }
        .padding(.vertical, Spacing.one)
        .onAppear { animating = true }
    }
}
