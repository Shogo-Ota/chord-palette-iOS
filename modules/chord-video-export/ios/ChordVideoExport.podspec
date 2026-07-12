Pod::Spec.new do |s|
  s.name           = 'ChordVideoExport'
  s.version        = '1.0.0'
  s.summary        = 'Chord Palette native 9:16 video exporter (Phase 4).'
  s.description    = 'Renders the chord + keyboard visual to 1080x1920 frames with Core Graphics and muxes them with an offline-rendered audio track via AVAssetWriter.'
  s.author         = 'Chord Palette'
  s.homepage       = 'https://chord-palette.app'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
