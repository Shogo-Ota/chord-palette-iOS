import ExpoModulesCore

struct CompareSceneTimePlanRecord: Record {
  @Field var schemaVersion: Int = 1
  @Field var sampleRate: Int = 0
  @Field var durationSamples: Int = 0
  @Field var fpsNumerator: Int = 30
  @Field var fpsDenominator: Int = 1
}

struct CompareSceneCopyRecord: Record {
  @Field var hook: String = ""
  @Field var baseLabel: String = "原型"
  @Field var variantLabel: String = "変奏"
  @Field var closing: String = ""
}

struct CompareSceneCardRecord: Record {
  @Field var eventId: String = ""
  @Field var displayName: String = ""
  @Field var degreeLabel: String = ""
  @Field var changed: Bool = false
}

struct CompareScenePageRecord: Record {
  @Field var id: String = ""
  @Field var role: String = "base"
  @Field var pageIndex: Int = 0
  @Field var cards: [CompareSceneCardRecord] = []
}

struct CompareSceneCueRecord: Record {
  @Field var id: String = ""
  @Field var role: String = "base"
  @Field var eventId: String = ""
  @Field var sourceIndex: Int = 0
  @Field var startSample: Int = 0
  @Field var durationSamples: Int = 0
  @Field var anticipationStartSample: Int = 0
  @Field var pageIndex: Int = 0
  @Field var currentChord: String = ""
  @Field var nextChord: String?
  @Field var changeLabel: String?
  @Field var changed: Bool = false
}

struct CompareSceneRecord: Record {
  @Field var schemaVersion: Int = 1
  @Field var templateId: String = "compare"
  @Field var themeVersion: Int = 1
  @Field var motion: String = "standard"
  @Field var title: String = ""
  @Field var productName: String = "Chord Palette"
  @Field var timePlan: CompareSceneTimePlanRecord = CompareSceneTimePlanRecord()
  @Field var copy: CompareSceneCopyRecord = CompareSceneCopyRecord()
  @Field var pages: [CompareScenePageRecord] = []
  @Field var cues: [CompareSceneCueRecord] = []
}

struct CompareSceneCard {
  let eventId: String
  let displayName: String
  let degreeLabel: String
  let changed: Bool
}

struct CompareScenePage {
  let id: String
  let role: String
  let pageIndex: Int
  let cards: [CompareSceneCard]
}

struct CompareSceneCue {
  let id: String
  let role: String
  let eventId: String
  let sourceIndex: Int
  let startSample: Int
  let durationSamples: Int
  let anticipationStartSample: Int
  let pageIndex: Int
  let currentChord: String
  let nextChord: String?
  let changeLabel: String?
  let changed: Bool
}

struct CompareScene {
  let sampleRate: Int
  let durationSamples: Int
  let fpsNumerator: Int
  let fpsDenominator: Int
  let motion: String
  let title: String
  let productName: String
  let hook: String
  let baseLabel: String
  let variantLabel: String
  let closing: String
  let pages: [CompareScenePage]
  let cues: [CompareSceneCue]
}

extension CompareSceneRecord {
  func makeScene() -> CompareScene {
    CompareScene(
      sampleRate: timePlan.sampleRate,
      durationSamples: timePlan.durationSamples,
      fpsNumerator: timePlan.fpsNumerator,
      fpsDenominator: timePlan.fpsDenominator,
      motion: motion,
      title: title,
      productName: productName,
      hook: copy.hook,
      baseLabel: copy.baseLabel,
      variantLabel: copy.variantLabel,
      closing: copy.closing,
      pages: pages.map {
        CompareScenePage(
          id: $0.id,
          role: $0.role,
          pageIndex: $0.pageIndex,
          cards: $0.cards.map {
            CompareSceneCard(
              eventId: $0.eventId,
              displayName: $0.displayName,
              degreeLabel: $0.degreeLabel,
              changed: $0.changed
            )
          }
        )
      },
      cues: cues.map {
        CompareSceneCue(
          id: $0.id,
          role: $0.role,
          eventId: $0.eventId,
          sourceIndex: $0.sourceIndex,
          startSample: $0.startSample,
          durationSamples: $0.durationSamples,
          anticipationStartSample: $0.anticipationStartSample,
          pageIndex: $0.pageIndex,
          currentChord: $0.currentChord,
          nextChord: $0.nextChord,
          changeLabel: $0.changeLabel,
          changed: $0.changed
        )
      }
    )
  }
}
