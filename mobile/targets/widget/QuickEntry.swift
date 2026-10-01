import WidgetKit
import SwiftUI

// Widget neukazuje žádná zdravotní data — jen tlačítka, která otevřou
// zápis v aplikaci (po odemknutí Face ID / heslem).

struct QuickEntry: TimelineEntry {
  let date: Date
}

struct QuickProvider: TimelineProvider {
  func placeholder(in context: Context) -> QuickEntry { QuickEntry(date: .now) }
  func getSnapshot(in context: Context, completion: @escaping (QuickEntry) -> Void) { completion(QuickEntry(date: .now)) }
  func getTimeline(in context: Context, completion: @escaping (Timeline<QuickEntry>) -> Void) {
    completion(Timeline(entries: [QuickEntry(date: .now)], policy: .never))
  }
}

extension Color {
  init(hex: UInt32) {
    self.init(red: Double((hex >> 16) & 0xFF) / 255, green: Double((hex >> 8) & 0xFF) / 255, blue: Double(hex & 0xFF) / 255)
  }
}

enum Palette {
  static let ink = Color(hex: 0x17161A)
  static let muted = Color(hex: 0x514F57)
  static let orange = Color(hex: 0xF7931E)
  static let bgTop = Color(hex: 0xFFF7EE)
  static let bgBottom = Color(hex: 0xF4F1FA)
}

/// Pět obličejů jako v aplikaci (MOODS): barva, podklad, tvar úst.
struct Mood {
  let label: String
  let color: Color
  let tint: Color
  /// Ústa v souřadnicích 24×24: začátek/konec y a kontrolní bod y.
  let edgeY: CGFloat
  let ctrlY: CGFloat
}

let moods: [Mood] = [
  Mood(label: "Velmi špatně", color: Color(hex: 0xC2413A), tint: Color(hex: 0xFBE4E2), edgeY: 16.6, ctrlY: 13.4),
  Mood(label: "Špatně", color: Color(hex: 0xC8661C), tint: Color(hex: 0xFCEBDD), edgeY: 16.0, ctrlY: 14.2),
  Mood(label: "Ujde to", color: Color(hex: 0x514F57), tint: Color(hex: 0xF1F0EE), edgeY: 15.2, ctrlY: 15.2),
  Mood(label: "Dobře", color: Color(hex: 0xB97300), tint: Color(hex: 0xFDF1D8), edgeY: 14.4, ctrlY: 16.4),
  Mood(label: "Výborně", color: Color(hex: 0xE07A0B), tint: Color(hex: 0xFFE7C7), edgeY: 14.0, ctrlY: 18.0),
]

struct FaceShape: Shape {
  let mood: Mood
  func path(in rect: CGRect) -> Path {
    let s = rect.width / 24
    var p = Path()
    p.addEllipse(in: CGRect(x: 3 * s, y: 3 * s, width: 18 * s, height: 18 * s))
    p.move(to: CGPoint(x: 8.4 * s, y: mood.edgeY * s))
    p.addQuadCurve(to: CGPoint(x: 15.6 * s, y: mood.edgeY * s), control: CGPoint(x: 12 * s, y: mood.ctrlY * s))
    return p
  }
}

struct FaceView: View {
  let mood: Mood
  let size: CGFloat
  var body: some View {
    ZStack {
      Circle().fill(mood.tint)
      FaceShape(mood: mood)
        .stroke(mood.color, style: StrokeStyle(lineWidth: size / 16, lineCap: .round, lineJoin: .round))
        .frame(width: size * 0.62, height: size * 0.62)
      HStack(spacing: size * 0.16) {
        Circle().fill(mood.color).frame(width: size * 0.07, height: size * 0.07)
        Circle().fill(mood.color).frame(width: size * 0.07, height: size * 0.07)
      }
      .offset(y: -size * 0.05)
    }
    .frame(width: size, height: size)
    .accessibilityLabel(mood.label)
  }
}

struct Pill: View {
  let title: String
  let systemImage: String
  let fill: Color
  var body: some View {
    HStack(spacing: 6) {
      Image(systemName: systemImage).font(.system(size: 12, weight: .bold))
      Text(title).font(.system(size: 14, weight: .semibold))
    }
    .foregroundStyle(.white)
    .frame(maxWidth: .infinity, minHeight: 36)
    .background(Capsule().fill(fill))
  }
}

struct QuickEntryView: View {
  @Environment(\.widgetFamily) var family
  let entry: QuickEntry

  var body: some View {
    switch family {
    case .systemSmall: small
    default: medium
    }
  }

  var small: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text("Jak se cítíte?")
        .font(.system(size: 15, weight: .semibold))
        .foregroundStyle(Palette.ink)
      HStack(spacing: 4) {
        FaceView(mood: moods[1], size: 30)
        FaceView(mood: moods[2], size: 30)
        FaceView(mood: moods[3], size: 30)
      }
      Spacer(minLength: 0)
      Pill(title: "Zapsat", systemImage: "plus", fill: Palette.ink)
    }
    .widgetURL(URL(string: "lifeos://zapis"))
  }

  var medium: some View {
    VStack(alignment: .leading, spacing: 10) {
      HStack {
        Text("Jak se cítíte?")
          .font(.system(size: 16, weight: .semibold))
          .foregroundStyle(Palette.ink)
        Spacer()
        Text("Life").font(.system(size: 12, weight: .semibold)).foregroundStyle(Palette.ink)
          + Text("OS").font(.system(size: 12)).foregroundStyle(Palette.muted)
      }
      HStack(spacing: 0) {
        ForEach(0..<moods.count, id: \.self) { i in
          Link(destination: URL(string: "lifeos://zapis?mood=\(i)")!) {
            FaceView(mood: moods[i], size: 40)
          }
          if i < moods.count - 1 { Spacer(minLength: 0) }
        }
      }
      HStack(spacing: 8) {
        Link(destination: URL(string: "lifeos://zapis")!) {
          Pill(title: "Příznaky", systemImage: "waveform.path.ecg", fill: Palette.orange)
        }
        Link(destination: URL(string: "lifeos://zaznam/upravit")!) {
          Pill(title: "Záznam", systemImage: "plus", fill: Palette.ink)
        }
      }
    }
  }
}

struct QuickEntryWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "LifeOSQuickEntry", provider: QuickProvider()) { entry in
      QuickEntryView(entry: entry)
        .containerBackground(for: .widget) {
          LinearGradient(colors: [Palette.bgTop, Palette.bgBottom], startPoint: .topLeading, endPoint: .bottomTrailing)
        }
    }
    .configurationDisplayName("Rychlý zápis")
    .description("Nálada, příznaky a záznam do časové osy jedním klepnutím.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

// Zamčená obrazovka: kulaté „+“ a obdélník s textem.
struct LockScreenView: View {
  @Environment(\.widgetFamily) var family
  let entry: QuickEntry

  var body: some View {
    switch family {
    case .accessoryRectangular:
      HStack(spacing: 8) {
        Image(systemName: "plus.circle.fill").font(.system(size: 22))
        VStack(alignment: .leading, spacing: 0) {
          Text("LifeOS").font(.system(size: 13, weight: .semibold))
          Text("Zapsat, jak se cítím").font(.system(size: 12))
        }
      }
      .widgetURL(URL(string: "lifeos://zapis"))
    default:
      ZStack {
        AccessoryWidgetBackground()
        Image(systemName: "plus").font(.system(size: 20, weight: .semibold))
      }
      .widgetURL(URL(string: "lifeos://zapis"))
      .accessibilityLabel("Zapsat, jak se cítím")
    }
  }
}

struct LockScreenWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "LifeOSLockScreen", provider: QuickProvider()) { entry in
      LockScreenView(entry: entry)
        .containerBackground(for: .widget) { Color.clear }
    }
    .configurationDisplayName("Zápis z uzamčené obrazovky")
    .description("Klepnutím otevřete zápis (po odemknutí).")
    .supportedFamilies([.accessoryCircular, .accessoryRectangular])
  }
}
