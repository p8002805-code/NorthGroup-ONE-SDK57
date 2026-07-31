import ExpoModulesCore
import QuickLook
import RealityKit
import SwiftUI
import UIKit

private let brandNavy = Color(
  red: 6.0 / 255.0,
  green: 26.0 / 255.0,
  blue: 45.0 / 255.0
)
private let brandGold = Color(
  red: 214.0 / 255.0,
  green: 168.0 / 255.0,
  blue: 79.0 / 255.0
)

struct NorthGroupScannerOptions: Record {
  @Field var jobNumber: String = ""
  @Field var featureId: String = ""
  @Field var notes: String = ""
}

private final class ScannerPresentationCoordinator {
  var controller: UIViewController?
  private let promise: Promise
  private var finished = false

  init(promise: Promise) {
    self.promise = promise
  }

  func complete(modelURL: URL, scanDirectory: URL) {
    guard !finished else { return }
    finished = true
    controller?.dismiss(animated: true) {
      self.promise.resolve([
        "cancelled": false,
        "modelUri": modelURL.absoluteString,
        "scanDirectoryUri": scanDirectory.absoluteString
      ])
      self.controller = nil
    }
  }

  func cancel() {
    guard !finished else { return }
    finished = true
    controller?.dismiss(animated: true) {
      self.promise.resolve(["cancelled": true])
      self.controller = nil
    }
  }

  func fail(_ message: String) {
    guard !finished else { return }
    finished = true
    controller?.dismiss(animated: true) {
      self.promise.reject("ERR_NORTHGROUP_SCANNER", message)
      self.controller = nil
    }
  }
}

private final class ModelPreviewDataSource: NSObject, QLPreviewControllerDataSource {
  let modelURL: URL

  init(modelURL: URL) {
    self.modelURL = modelURL
  }

  func numberOfPreviewItems(in controller: QLPreviewController) -> Int {
    1
  }

  func previewController(
    _ controller: QLPreviewController,
    previewItemAt index: Int
  ) -> QLPreviewItem {
    modelURL as NSURL
  }
}

public class NorthGroupScannerModule: Module {
  private var activeScanner: ScannerPresentationCoordinator?
  private var previewDataSource: ModelPreviewDataSource?

  public func definition() -> ModuleDefinition {
    Name("NorthGroupScanner")

    Function("getCapabilities") {
      if #available(iOS 18.0, *) {
        let supported = ObjectCaptureSession.isSupported
          && PhotogrammetrySession.isSupported
        return [
          "available": supported,
          "mode": "area",
          "minimumIOS": "18.0",
          "format": "usdz",
          "reason": supported ? "" : "device-not-supported"
        ] as [String: Any]
      }

      return [
        "available": false,
        "mode": "area",
        "minimumIOS": "18.0",
        "format": "usdz",
        "reason": "ios-version-not-supported"
      ] as [String: Any]
    }

    AsyncFunction("launchScanner") {
      (options: NorthGroupScannerOptions, promise: Promise) in
      Task { @MainActor in
        self.presentScanner(options: options, promise: promise)
      }
    }

    AsyncFunction("previewModel") { (modelUri: String, promise: Promise) in
      Task { @MainActor in
        self.presentPreview(modelUri: modelUri, promise: promise)
      }
    }
  }

  @MainActor
  private func presentScanner(
    options: NorthGroupScannerOptions,
    promise: Promise
  ) {
    guard activeScanner == nil else {
      promise.reject(
        "ERR_NORTHGROUP_SCANNER_ACTIVE",
        "A 3D scan is already open."
      )
      return
    }

    guard #available(iOS 18.0, *) else {
      promise.reject(
        "ERR_NORTHGROUP_SCANNER_IOS",
        "3D area scanning requires iOS 18 or later."
      )
      return
    }

    guard ObjectCaptureSession.isSupported,
          PhotogrammetrySession.isSupported else {
      promise.reject(
        "ERR_NORTHGROUP_SCANNER_DEVICE",
        "This iPhone does not support Apple Object Capture."
      )
      return
    }

    guard let presenter = Self.topViewController() else {
      promise.reject(
        "ERR_NORTHGROUP_SCANNER_PRESENTATION",
        "NorthGroup One could not open the scanner."
      )
      return
    }

    let coordinator = ScannerPresentationCoordinator(promise: promise)
    let scannerView = NorthGroupAreaScannerView(
      options: options,
      onComplete: { [weak self, weak coordinator] modelURL, scanDirectory in
        coordinator?.complete(modelURL: modelURL, scanDirectory: scanDirectory)
        self?.activeScanner = nil
      },
      onCancel: { [weak self, weak coordinator] in
        coordinator?.cancel()
        self?.activeScanner = nil
      },
      onFailure: { [weak self, weak coordinator] message in
        coordinator?.fail(message)
        self?.activeScanner = nil
      }
    )

    let controller = UIHostingController(rootView: scannerView)
    controller.modalPresentationStyle = .fullScreen
    coordinator.controller = controller
    activeScanner = coordinator
    presenter.present(controller, animated: true)
  }

  @MainActor
  private func presentPreview(modelUri: String, promise: Promise) {
    guard let modelURL = URL(string: modelUri),
          modelURL.isFileURL,
          FileManager.default.fileExists(atPath: modelURL.path) else {
      promise.reject(
        "ERR_NORTHGROUP_SCANNER_MODEL",
        "The saved 3D model could not be found."
      )
      return
    }

    guard let presenter = Self.topViewController() else {
      promise.reject(
        "ERR_NORTHGROUP_SCANNER_PREVIEW",
        "NorthGroup One could not open the 3D preview."
      )
      return
    }

    let dataSource = ModelPreviewDataSource(modelURL: modelURL)
    let controller = QLPreviewController()
    controller.dataSource = dataSource
    previewDataSource = dataSource
    presenter.present(controller, animated: true) {
      promise.resolve(nil)
    }
  }

  @MainActor
  private static func topViewController(
    from root: UIViewController? = {
      let scenes = UIApplication.shared.connectedScenes
        .compactMap { $0 as? UIWindowScene }
      let window = scenes
        .flatMap(\.windows)
        .first(where: \.isKeyWindow)
      return window?.rootViewController
    }()
  ) -> UIViewController? {
    if let navigation = root as? UINavigationController {
      return topViewController(from: navigation.visibleViewController)
    }

    if let tabs = root as? UITabBarController,
       let selected = tabs.selectedViewController {
      return topViewController(from: selected)
    }

    if let presented = root?.presentedViewController {
      return topViewController(from: presented)
    }

    return root
  }
}

@available(iOS 18.0, *)
private struct NorthGroupScanWorkspace {
  let rootDirectory: URL
  let imagesDirectory: URL
  let checkpointsDirectory: URL
  let modelURL: URL

  init(options: NorthGroupScannerOptions) throws {
    let documents = try FileManager.default.url(
      for: .documentDirectory,
      in: .userDomainMask,
      appropriateFor: nil,
      create: true
    )
    let scansDirectory = documents
      .appendingPathComponent("NorthGroup One Scans", isDirectory: true)

    let timestamp = ISO8601DateFormatter()
      .string(from: Date())
      .replacingOccurrences(of: ":", with: "-")
    let job = Self.safeName(options.jobNumber, fallback: "NO-JOB")
    let feature = Self.safeName(options.featureId, fallback: "SCAN")
    let root = scansDirectory.appendingPathComponent(
      "\(job)-\(feature)-\(timestamp)",
      isDirectory: true
    )
    let images = root.appendingPathComponent("Images", isDirectory: true)
    let checkpoints = root
      .appendingPathComponent("Checkpoints", isDirectory: true)

    try FileManager.default.createDirectory(
      at: images,
      withIntermediateDirectories: true
    )
    try FileManager.default.createDirectory(
      at: checkpoints,
      withIntermediateDirectories: true
    )

    rootDirectory = root
    imagesDirectory = images
    checkpointsDirectory = checkpoints
    modelURL = root.appendingPathComponent("\(job)-\(feature).usdz")
  }

  private static func safeName(_ value: String, fallback: String) -> String {
    let upper = value.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
    let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-_"))
    let cleaned = upper.unicodeScalars
      .map { allowed.contains($0) ? String($0) : "-" }
      .joined()
      .replacingOccurrences(of: "--", with: "-")
      .trimmingCharacters(in: CharacterSet(charactersIn: "-"))
    return cleaned.isEmpty ? fallback : cleaned
  }
}

@available(iOS 18.0, *)
@MainActor
private struct NorthGroupAreaScannerView: View {
  let options: NorthGroupScannerOptions
  let onComplete: (URL, URL) -> Void
  let onCancel: () -> Void
  let onFailure: (String) -> Void

  @State private var captureSession = ObjectCaptureSession()
  @State private var workspace: NorthGroupScanWorkspace?
  @State private var didPrepare = false
  @State private var isReconstructing = false
  @State private var errorMessage = ""

  var body: some View {
    ZStack {
      brandNavy.ignoresSafeArea()

      ObjectCaptureView(session: captureSession)
        .ignoresSafeArea()

      VStack(spacing: 0) {
        header
        Spacer()
        controls
      }

      if isReconstructing {
        reconstructionOverlay
      }
    }
    .preferredColorScheme(.dark)
    .onAppear(perform: prepareCapture)
    .onChange(of: captureSession.state) { _, state in
      handleCaptureState(state)
    }
  }

  private var header: some View {
    HStack(spacing: 12) {
      Button("Cancel", action: cancelCapture)
        .font(.system(size: 15, weight: .semibold))
        .foregroundStyle(.white)

      VStack(alignment: .leading, spacing: 2) {
        Text("3D FEATURE SCANNER")
          .font(.system(size: 11, weight: .bold))
          .tracking(1.3)
          .foregroundStyle(brandGold)
        Text("\(options.jobNumber) · \(options.featureId)")
          .font(.system(size: 15, weight: .bold))
          .foregroundStyle(.white)
          .lineLimit(1)
      }

      Spacer()

      Text("AREA")
        .font(.system(size: 10, weight: .heavy))
        .tracking(1)
        .padding(.horizontal, 10)
        .padding(.vertical, 7)
        .foregroundStyle(brandNavy)
        .background(brandGold)
        .clipShape(Capsule())
    }
    .padding(.horizontal, 18)
    .padding(.vertical, 14)
    .background(brandNavy.opacity(0.94))
  }

  @ViewBuilder
  private var controls: some View {
    VStack(spacing: 12) {
      Text(statusTitle)
        .font(.system(size: 20, weight: .bold))
        .foregroundStyle(.white)

      Text(statusDetail)
        .font(.system(size: 13, weight: .medium))
        .multilineTextAlignment(.center)
        .foregroundStyle(.white.opacity(0.82))

      if !errorMessage.isEmpty {
        Text(errorMessage)
          .font(.system(size: 12, weight: .semibold))
          .multilineTextAlignment(.center)
          .foregroundStyle(Color(red: 1, green: 0.68, blue: 0.64))
      }

      if case .ready = captureSession.state {
        primaryButton("START CAPTURE") {
          captureSession.startCapturing()
        }
      } else if case .capturing = captureSession.state {
        primaryButton("FINISH & BUILD MODEL") {
          captureSession.finish()
        }
      }
    }
    .padding(.horizontal, 22)
    .padding(.top, 18)
    .padding(.bottom, 28)
    .background(
      LinearGradient(
        colors: [brandNavy.opacity(0.25), brandNavy.opacity(0.97)],
        startPoint: .top,
        endPoint: .center
      )
    )
  }

  private func primaryButton(
    _ title: String,
    action: @escaping () -> Void
  ) -> some View {
    Button(action: action) {
      Text(title)
        .font(.system(size: 15, weight: .heavy))
        .tracking(0.5)
        .frame(maxWidth: .infinity)
        .padding(.vertical, 16)
        .foregroundStyle(brandNavy)
        .background(brandGold)
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }
  }

  private var reconstructionOverlay: some View {
    ZStack {
      brandNavy.opacity(0.94).ignoresSafeArea()
      VStack(spacing: 18) {
        ProgressView()
          .controlSize(.large)
          .tint(brandGold)
        Text("Building 3D model…")
          .font(.system(size: 21, weight: .bold))
          .foregroundStyle(.white)
        Text("Keep NorthGroup One open. Reconstruction may take several minutes.")
          .font(.system(size: 13, weight: .medium))
          .multilineTextAlignment(.center)
          .foregroundStyle(.white.opacity(0.76))
          .padding(.horizontal, 36)
      }
    }
  }

  private var statusTitle: String {
    if case .initializing = captureSession.state { return "Preparing camera…" }
    if case .ready = captureSession.state { return "Ready to scan" }
    if case .detecting = captureSession.state { return "Locating feature…" }
    if case .capturing = captureSession.state { return "Paint across the feature" }
    if case .finishing = captureSession.state { return "Saving capture…" }
    if case .completed = captureSession.state { return "Capture complete" }
    if case .failed = captureSession.state { return "Capture stopped" }
    return "3D scanner"
  }

  private var statusDetail: String {
    if case .ready = captureSession.state {
      return "Move slowly in overlapping rows and keep the feature inside the camera view."
    }
    if case .capturing = captureSession.state {
      return "Cover the surface from several angles. Avoid people, vehicles and moving shadows."
    }
    if case .finishing = captureSession.state {
      return "Finalising the captured images and LiDAR data."
    }
    return "Best results are achieved in even, diffuse light."
  }

  private func prepareCapture() {
    guard !didPrepare else { return }
    didPrepare = true

    do {
      let nextWorkspace = try NorthGroupScanWorkspace(options: options)
      workspace = nextWorkspace
      var configuration = ObjectCaptureSession.Configuration()
      configuration.checkpointDirectory = nextWorkspace.checkpointsDirectory
      captureSession.start(
        imagesDirectory: nextWorkspace.imagesDirectory,
        configuration: configuration
      )
    } catch {
      let message = "The scanner could not create its working folder: \(error.localizedDescription)"
      errorMessage = message
      onFailure(message)
    }
  }

  private func cancelCapture() {
    captureSession.cancel()
    onCancel()
  }

  private func handleCaptureState(_ state: ObjectCaptureSession.CaptureState) {
    switch state {
    case .completed:
      reconstructModel()
    case .failed(let error):
      let message = "Capture failed: \(error.localizedDescription)"
      errorMessage = message
      onFailure(message)
    default:
      break
    }
  }

  private func reconstructModel() {
    guard !isReconstructing, let workspace else { return }
    isReconstructing = true

    Task { @MainActor in
      do {
        var configuration = PhotogrammetrySession.Configuration()
        configuration.checkpointDirectory = workspace.checkpointsDirectory
        let reconstruction = try PhotogrammetrySession(
          input: workspace.imagesDirectory,
          configuration: configuration
        )
        try reconstruction.process(
          requests: [.modelFile(url: workspace.modelURL)]
        )

        for try await output in reconstruction.outputs {
          switch output {
          case .processingComplete:
            guard FileManager.default.fileExists(atPath: workspace.modelURL.path) else {
              throw NSError(
                domain: "NorthGroupScanner",
                code: 1,
                userInfo: [
                  NSLocalizedDescriptionKey: "The 3D model finished without producing a USDZ file."
                ]
              )
            }
            onComplete(workspace.modelURL, workspace.rootDirectory)
            return
          case .requestError(_, let error):
            throw error
          case .processingCancelled:
            throw NSError(
              domain: "NorthGroupScanner",
              code: 2,
              userInfo: [NSLocalizedDescriptionKey: "3D reconstruction was cancelled."]
            )
          default:
            continue
          }
        }
      } catch {
        isReconstructing = false
        let message = "3D reconstruction failed: \(error.localizedDescription)"
        errorMessage = message
        onFailure(message)
      }
    }
  }
}
