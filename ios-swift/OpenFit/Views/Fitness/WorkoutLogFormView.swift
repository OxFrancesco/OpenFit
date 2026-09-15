import SwiftUI

// Port of src/components/fitness/workout-log-form.tsx (spec §2.3).

struct WorkoutLogFormView: View {
    var exercise: Exercise
    var onSaved: () -> Void

    @EnvironmentObject private var fitness: FitnessStore
    @Environment(\.dismiss) private var dismiss

    @State private var sets = "3"
    @State private var reps = "8"
    @State private var weight = ""
    @State private var unit: WeightUnit = .kg
    @State private var notes = ""
    @State private var saving = false
    @State private var error: String?

    private var exerciseLogs: [WorkoutLog] { fitness.logs(for: exercise.id) }
    private var bestKg: Double { personalBestKg(exerciseLogs, exerciseId: exercise.id) }

    private func parseNumber(_ value: String) -> Double? {
        let parsed = Double(value.trimmingCharacters(in: .whitespaces)
            .replacingOccurrences(of: ",", with: "."))
        return parsed.flatMap { $0.isFinite ? $0 : nil }
    }

    private func changeUnit(_ next: WeightUnit) {
        guard next != unit else { return }
        if let parsed = parseNumber(weight) {
            let kg = toKilograms(parsed, unit: unit)
            weight = displayInputNumber(fromKilograms(kg, unit: next))
        }
        unit = next
    }

    var body: some View {
        ScrollView {
            VStack(spacing: Spacing.four) {
                // Header card
                HStack(spacing: 20) {
                    Image(systemName: "dumbbell.fill")
                        .font(.system(size: 32))
                        .foregroundStyle(Theme.onSecondaryContainer)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(exercise.name).themed(.subtitle, color: Theme.onSecondaryContainer)
                        Text("\(exercise.primaryMuscle) · \(exercise.equipment)")
                            .themed(.small, color: Theme.onSecondaryContainer)
                        if bestKg > 0 {
                            Text("Personal best \(formatWeight(bestKg, unit: unit))").themed(.small)
                        }
                    }
                    Spacer()
                }
                .padding(Spacing.four)
                .background(Theme.secondaryContainer)
                .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))

                HStack(spacing: Spacing.three) {
                    field("Sets", text: $sets, keyboard: .numberPad)
                    field("Reps", text: $reps, keyboard: .numberPad)
                }

                HStack(spacing: Spacing.three) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(exercise.equipment == "Bodyweight" ? "Added weight" : "Weight")
                            .themed(.caption, color: Theme.textSecondary)
                        TextField("0", text: $weight)
                            .keyboardType(.decimalPad)
                            .padding(Spacing.two)
                            .overlay(RoundedRectangle(cornerRadius: 6, style: .continuous)
                                .strokeBorder(Theme.outline, lineWidth: 0.5))
                    }
                    Picker("Unit", selection: Binding(get: { unit }, set: { changeUnit($0) })) {
                        Text("kg").tag(WeightUnit.kg)
                        Text("lb").tag(WeightUnit.lb)
                    }
                    .pickerStyle(.segmented)
                    .frame(width: 144)
                    .padding(.top, 18)
                }

                VStack(alignment: .leading, spacing: 4) {
                    Text("Notes, optional").themed(.caption, color: Theme.textSecondary)
                    TextField("Form, tempo or machine setting", text: $notes, axis: .vertical)
                        .lineLimit(4...8)
                        .padding(Spacing.two)
                        .overlay(RoundedRectangle(cornerRadius: 6, style: .continuous)
                            .strokeBorder(Theme.outline, lineWidth: 0.5))
                        .onChange(of: notes) { if notes.count > 500 { notes = String(notes.prefix(500)) } }
                }

                if let error {
                    Text(error).themed(.small, color: Theme.error)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .padding(24)
            .frame(maxWidth: 640)
            .frame(maxWidth: .infinity)
        }
        .background(Theme.background)
        .safeAreaInset(edge: .bottom) {
            Button { save() } label: {
                if saving {
                    ProgressView()
                        .frame(maxWidth: .infinity, minHeight: 56)
                } else {
                    Label("Save workout", systemImage: "checkmark")
                        .themed(.smallBold, color: Theme.onPrimary)
                        .frame(maxWidth: .infinity, minHeight: 56)
                }
            }
            .background(Theme.primary)
            .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
            .padding(24)
            .padding(.bottom, 8)
            .accessibilityLabel("Save \(exercise.name) entry")
        }
        .onAppear {
            if let previous = exerciseLogs.first {
                sets = String(previous.sets)
                reps = String(previous.reps)
                unit = previous.enteredUnit
                weight = displayInputNumber(fromKilograms(previous.weightKg, unit: previous.enteredUnit))
            }
        }
    }

    private func field(_ label: String, text: Binding<String>, keyboard: UIKeyboardType) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).themed(.caption, color: Theme.textSecondary)
            TextField(label, text: text)
                .keyboardType(keyboard)
                .padding(Spacing.two)
                .overlay(RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .strokeBorder(Theme.outline, lineWidth: 0.5))
        }
    }

    private func save() {
        let parsedSets = parseNumber(sets).flatMap { $0 == $0.rounded() ? Int($0) : nil }
        let parsedReps = parseNumber(reps).flatMap { $0 == $0.rounded() ? Int($0) : nil }
        let parsedWeight = parseNumber(weight.isEmpty ? "0" : weight)
        let weightKg = parsedWeight.map { toKilograms($0, unit: unit) }

        if let validationError = validateWorkoutInput(sets: parsedSets, reps: parsedReps,
                                                    weightKg: weightKg, notes: notes.trimmingCharacters(in: .whitespacesAndNewlines)) {
            error = validationError
            return
        }
        saving = true
        error = nil
        fitness.save(exerciseId: exercise.id,
                     sets: parsedSets!, reps: parsedReps!,
                     weightKg: weightKg!, enteredUnit: unit,
                     notes: notes.trimmingCharacters(in: .whitespacesAndNewlines))
        onSaved()
        dismiss()
    }
}
