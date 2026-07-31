Pod::Spec.new do |s|
  s.name             = 'NorthGroupScanner'
  s.version          = '1.0.0'
  s.summary          = 'NorthGroup One native 3D feature scanner'
  s.description      = 'Apple Object Capture bridge for NorthGroup One.'
  s.author           = 'North Surveys Pty. Ltd.'
  s.homepage         = 'https://northgroup.com.au'
  s.platforms        = {
    :ios => '15.1'
  }
  s.swift_version    = '5.9'
  s.source           = { git: 'https://northgroup.com.au' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES'
  }

  s.source_files = '**/*.swift'
end
