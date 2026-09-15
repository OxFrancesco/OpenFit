import SwiftUI

// Port of src/components/legal-page.tsx (spec §2.6).

let openFitContactEmail = "oddofrancesco000@gmail.com"
let openFitProvider = "Francesco Oddo"

struct LegalPageView<Content: View>: View {
    var updated: String
    @ViewBuilder var content: () -> Content

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                Text("Effective date: \(updated)")
                    .themed(.small, color: Theme.textSecondary)
                    .padding(.bottom, Spacing.four)
                    .frame(maxWidth: .infinity, alignment: .leading)
                content()
            }
            .padding(.horizontal, Spacing.four)
            .padding(.vertical, Spacing.five)
            .frame(maxWidth: maxContentWidth)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Theme.background)
    }
}

struct LegalSection<Content: View>: View {
    var title: String
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(title).themed(.subtitle)
            VStack(alignment: .leading, spacing: 0) { content() }
                .padding(.top, Spacing.two)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.bottom, Spacing.four)
    }
}

struct LegalParagraph: View {
    var text: String
    init(_ text: String) { self.text = text }
    var body: some View {
        Text(text).themed(.default)
            .padding(.bottom, Spacing.three)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct LegalBullet: View {
    var text: String
    init(_ text: String) { self.text = text }
    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 0) {
            Text("-").themed(.default).frame(width: 16)
            Text(text).themed(.default)
        }
        .padding(.bottom, Spacing.two)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
