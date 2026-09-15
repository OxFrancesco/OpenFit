import Foundation

// Verbatim port of src/lib/exercise-catalog.ts and the domain helpers from
// src/lib/fitness-domain.ts (spec §3.7).

struct Exercise: Identifiable, Hashable, Codable {
    var id: String
    var name: String
    var primaryMuscle: String
    var secondaryMuscles: [String]
    var equipment: String
    var category: String          // 'strength' | 'cardio' | 'mobility'
    var aliases: [String]
}

private func strength(_ id: String, _ name: String, _ primaryMuscle: String, _ equipment: String,
                      _ secondaryMuscles: [String] = [], _ aliases: [String] = []) -> Exercise {
    Exercise(id: id, name: name, primaryMuscle: primaryMuscle, secondaryMuscles: secondaryMuscles,
             equipment: equipment, category: "strength", aliases: aliases)
}

let exerciseCatalog: [Exercise] = [
    strength("barbell-bench-press", "Barbell Bench Press", "Chest", "Barbell", ["Triceps", "Shoulders"], ["bench press", "flat bench"]),
    strength("incline-bench-press", "Incline Barbell Bench Press", "Chest", "Barbell", ["Shoulders", "Triceps"], ["incline bench"]),
    strength("dumbbell-bench-press", "Dumbbell Bench Press", "Chest", "Dumbbell", ["Triceps", "Shoulders"], ["db bench"]),
    strength("incline-dumbbell-press", "Incline Dumbbell Press", "Chest", "Dumbbell", ["Shoulders", "Triceps"], ["incline db press"]),
    strength("chest-press-machine", "Chest Press Machine", "Chest", "Machine", ["Triceps"], ["machine press"]),
    strength("cable-fly", "Cable Fly", "Chest", "Cable", ["Shoulders"], ["cable crossover"]),
    strength("pec-deck", "Pec Deck Fly", "Chest", "Machine", [], ["butterfly machine"]),
    strength("push-up", "Push-Up", "Chest", "Bodyweight", ["Triceps", "Core"], ["press up"]),
    strength("weighted-dip", "Weighted Dip", "Chest", "Bodyweight", ["Triceps", "Shoulders"], ["chest dip"]),

    strength("conventional-deadlift", "Conventional Deadlift", "Back", "Barbell", ["Glutes", "Hamstrings", "Core"], ["deadlift"]),
    strength("barbell-row", "Barbell Bent-Over Row", "Back", "Barbell", ["Biceps", "Core"], ["bent over row"]),
    strength("one-arm-dumbbell-row", "One-Arm Dumbbell Row", "Back", "Dumbbell", ["Biceps"], ["single arm row"]),
    strength("chest-supported-row", "Chest-Supported Row", "Back", "Machine", ["Biceps"], ["supported row"]),
    strength("seated-cable-row", "Seated Cable Row", "Back", "Cable", ["Biceps"], ["low row"]),
    strength("lat-pulldown", "Lat Pulldown", "Back", "Cable", ["Biceps"], ["lat pull down"]),
    strength("pull-up", "Pull-Up", "Back", "Bodyweight", ["Biceps", "Core"], ["pullup"]),
    strength("chin-up", "Chin-Up", "Back", "Bodyweight", ["Biceps"], ["chinup"]),
    strength("straight-arm-pulldown", "Straight-Arm Pulldown", "Back", "Cable", ["Core"], ["cable pullover"]),
    strength("back-extension", "Back Extension", "Back", "Bodyweight", ["Glutes", "Hamstrings"], ["hyperextension"]),

    strength("back-squat", "Barbell Back Squat", "Legs", "Barbell", ["Glutes", "Core"], ["squat"]),
    strength("front-squat", "Front Squat", "Legs", "Barbell", ["Glutes", "Core"], []),
    strength("goblet-squat", "Goblet Squat", "Legs", "Dumbbell", ["Glutes", "Core"], []),
    strength("hack-squat", "Hack Squat", "Legs", "Machine", ["Glutes"], []),
    strength("leg-press", "Leg Press", "Legs", "Machine", ["Glutes"], []),
    strength("leg-extension", "Leg Extension", "Legs", "Machine", [], ["quad extension"]),
    strength("seated-leg-curl", "Seated Leg Curl", "Hamstrings", "Machine", [], ["hamstring curl"]),
    strength("lying-leg-curl", "Lying Leg Curl", "Hamstrings", "Machine", [], []),
    strength("romanian-deadlift", "Romanian Deadlift", "Hamstrings", "Barbell", ["Glutes", "Back"], ["rdl"]),
    strength("dumbbell-romanian-deadlift", "Dumbbell Romanian Deadlift", "Hamstrings", "Dumbbell", ["Glutes"], ["db rdl"]),
    strength("walking-lunge", "Walking Lunge", "Legs", "Dumbbell", ["Glutes", "Core"], ["lunges"]),
    strength("bulgarian-split-squat", "Bulgarian Split Squat", "Legs", "Dumbbell", ["Glutes", "Core"], ["rear foot elevated split squat"]),
    strength("standing-calf-raise", "Standing Calf Raise", "Calves", "Machine", [], []),
    strength("seated-calf-raise", "Seated Calf Raise", "Calves", "Machine", [], []),

    strength("barbell-hip-thrust", "Barbell Hip Thrust", "Glutes", "Barbell", ["Hamstrings"], ["hip thrust"]),
    strength("glute-bridge", "Glute Bridge", "Glutes", "Bodyweight", ["Hamstrings"], []),
    strength("cable-kickback", "Cable Glute Kickback", "Glutes", "Cable", ["Hamstrings"], ["glute kickback"]),
    strength("hip-abduction", "Hip Abduction Machine", "Glutes", "Machine", [], ["abductor machine"]),
    strength("kettlebell-swing", "Kettlebell Swing", "Glutes", "Kettlebell", ["Hamstrings", "Core"], ["kb swing"]),

    strength("overhead-press", "Barbell Overhead Press", "Shoulders", "Barbell", ["Triceps", "Core"], ["military press", "ohp"]),
    strength("seated-dumbbell-press", "Seated Dumbbell Shoulder Press", "Shoulders", "Dumbbell", ["Triceps"], ["db shoulder press"]),
    strength("arnold-press", "Arnold Press", "Shoulders", "Dumbbell", ["Triceps"], []),
    strength("lateral-raise", "Dumbbell Lateral Raise", "Shoulders", "Dumbbell", [], ["side raise"]),
    strength("cable-lateral-raise", "Cable Lateral Raise", "Shoulders", "Cable", [], []),
    strength("reverse-pec-deck", "Reverse Pec Deck", "Shoulders", "Machine", ["Back"], ["rear delt fly"]),
    strength("face-pull", "Face Pull", "Shoulders", "Cable", ["Back"], []),
    strength("upright-row", "Upright Row", "Shoulders", "Barbell", ["Traps"], []),
    strength("barbell-shrug", "Barbell Shrug", "Traps", "Barbell", [], ["shrugs"]),

    strength("barbell-curl", "Barbell Curl", "Biceps", "Barbell", ["Forearms"], ["bicep curl"]),
    strength("dumbbell-curl", "Dumbbell Curl", "Biceps", "Dumbbell", ["Forearms"], ["db curl"]),
    strength("hammer-curl", "Hammer Curl", "Biceps", "Dumbbell", ["Forearms"], []),
    strength("preacher-curl", "Preacher Curl", "Biceps", "Machine", [], []),
    strength("cable-curl", "Cable Curl", "Biceps", "Cable", [], []),
    strength("close-grip-bench", "Close-Grip Bench Press", "Triceps", "Barbell", ["Chest"], ["close grip bench"]),
    strength("triceps-pushdown", "Triceps Pushdown", "Triceps", "Cable", [], ["rope pushdown"]),
    strength("overhead-triceps-extension", "Overhead Triceps Extension", "Triceps", "Cable", [], []),
    strength("skull-crusher", "EZ-Bar Skull Crusher", "Triceps", "Barbell", [], ["lying triceps extension"]),
    strength("bench-dip", "Bench Dip", "Triceps", "Bodyweight", ["Chest"], []),

    strength("plank", "Plank", "Core", "Bodyweight", ["Shoulders"], []),
    strength("hanging-leg-raise", "Hanging Leg Raise", "Core", "Bodyweight", ["Hip flexors"], []),
    strength("cable-crunch", "Cable Crunch", "Core", "Cable", [], []),
    strength("ab-wheel-rollout", "Ab Wheel Rollout", "Core", "Bodyweight", ["Shoulders"], ["ab rollout"]),
    strength("russian-twist", "Russian Twist", "Core", "Bodyweight", ["Obliques"], []),
    strength("pallof-press", "Pallof Press", "Core", "Cable", ["Obliques"], []),
    strength("farmers-carry", "Farmer's Carry", "Full body", "Dumbbell", ["Core", "Forearms", "Traps"], ["farmer walk"]),
    strength("clean-and-press", "Clean and Press", "Full body", "Barbell", ["Legs", "Shoulders", "Core"], []),

    strength("smith-machine-squat", "Smith Machine Squat", "Legs", "Machine", ["Glutes"], ["smith squat"]),
    strength("good-morning", "Barbell Good Morning", "Hamstrings", "Barbell", ["Glutes", "Back"], ["good mornings"]),
    strength("cable-pullover", "Cable Pullover", "Back", "Cable", ["Core"], ["straight arm pullover"]),
    strength("landmine-press", "Landmine Press", "Shoulders", "Barbell", ["Chest", "Triceps"], []),
    strength("nordic-hamstring-curl", "Nordic Hamstring Curl", "Hamstrings", "Bodyweight", ["Glutes"], ["nordic curl"]),
    strength("wrist-curl", "Dumbbell Wrist Curl", "Forearms", "Dumbbell", [], ["forearm curl"]),
    strength("cable-wood-chop", "Cable Wood Chop", "Core", "Cable", ["Obliques"], ["woodchopper"]),
    strength("hip-adduction", "Hip Adduction Machine", "Legs", "Machine", [], ["adductor machine"]),
]

let exerciseMuscles: [String] = [
    "Chest", "Back", "Legs", "Hamstrings", "Calves", "Glutes", "Shoulders",
    "Traps", "Biceps", "Triceps", "Forearms", "Core", "Full body",
]

func catalogExercise(id: String) -> Exercise? {
    exerciseCatalog.first { $0.id == id }
}

// MARK: - Search (fitness-domain.ts searchExercises)

func normalizeSearchText(_ value: String) -> String {
    value.trimmingCharacters(in: .whitespaces)
        .lowercased(with: Locale.current)
        .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
}

private func exerciseSearchText(_ exercise: Exercise) -> String {
    normalizeSearchText(([exercise.name, exercise.primaryMuscle] + exercise.secondaryMuscles
        + [exercise.equipment, exercise.category] + exercise.aliases).joined(separator: " "))
}

func searchExercises(_ exercises: [Exercise], query: String, muscle: String? = nil,
                     equipment: String? = nil) -> [Exercise] {
    let normalizedQuery = normalizeSearchText(query)
    let tokens = normalizedQuery.split(separator: " ").map(String.init)
    let muscleFilter = normalizeSearchText(muscle ?? "")
    let equipmentFilter = normalizeSearchText(equipment ?? "")

    let filtered = exercises.filter { exercise in
        let muscleMatches = muscleFilter.isEmpty
            || normalizeSearchText(exercise.primaryMuscle) == muscleFilter
            || exercise.secondaryMuscles.contains { normalizeSearchText($0) == muscleFilter }
        let equipmentMatches = equipmentFilter.isEmpty
            || normalizeSearchText(exercise.equipment) == equipmentFilter
        let haystack = exerciseSearchText(exercise)
        return muscleMatches && equipmentMatches
            && tokens.allSatisfy { haystack.contains($0) }
    }
    let scored = filtered.map { exercise -> (Exercise, Int) in
        let name = normalizeSearchText(exercise.name)
        let aliases = exercise.aliases.map(normalizeSearchText)
        var score = 4
        if normalizedQuery.isEmpty { score = 3 }
        else if name == normalizedQuery || aliases.contains(normalizedQuery) { score = 0 }
        else if name.hasPrefix(normalizedQuery) || aliases.contains(where: { $0.hasPrefix(normalizedQuery) }) { score = 1 }
        else if name.contains(normalizedQuery) { score = 2 }
        return (exercise, score)
    }
    return scored
        .sorted { $0.1 != $1.1 ? $0.1 < $1.1 : $0.0.name.localizedCompare($1.0.name) == .orderedAscending }
        .map(\.0)
}

// MARK: - Weight helpers (fitness-domain.ts)

let poundsPerKilogram = 2.2046226218

enum WeightUnit: String, Codable, CaseIterable {
    case kg, lb
}

func toKilograms(_ value: Double, unit: WeightUnit) -> Double {
    unit == .lb ? value / poundsPerKilogram : value
}

func fromKilograms(_ value: Double, unit: WeightUnit) -> Double {
    unit == .lb ? value * poundsPerKilogram : value
}

func formatWeight(_ weightKg: Double, unit: WeightUnit) -> String {
    let value = fromKilograms(weightKg, unit: unit)
    let rounded = (value * 10).rounded() / 10
    let text = rounded == rounded.rounded() ? String(format: "%.0f", rounded) : String(format: "%.1f", rounded)
    return "\(text) \(unit.rawValue)"
}

func displayInputNumber(_ value: Double) -> String {
    let rounded = (value * 10).rounded() / 10
    return rounded == rounded.rounded() ? String(format: "%.0f", rounded) : String(format: "%.1f", rounded)
}
