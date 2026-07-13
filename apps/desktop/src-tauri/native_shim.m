#import <ApplicationServices/ApplicationServices.h>
#import <AppKit/AppKit.h>
#import <CoreGraphics/CoreGraphics.h>
#import <Foundation/Foundation.h>
#import <ImageIO/ImageIO.h>
#import <CoreImage/CoreImage.h>
#import <CoreMedia/CoreMedia.h>
#import <CoreVideo/CoreVideo.h>
#import <ScreenCaptureKit/ScreenCaptureKit.h>
#import <Vision/Vision.h>
#import <UserNotifications/UserNotifications.h>

#include <stdlib.h>
#include <stdbool.h>
#include <string.h>

static char *helix_json_copy(NSDictionary *value) {
    NSError *error = nil;
    NSData *data = [NSJSONSerialization dataWithJSONObject:value options:0 error:&error];
    if (!data || error) return NULL;
    char *result = calloc(data.length + 1, sizeof(char));
    if (!result) return NULL;
    memcpy(result, data.bytes, data.length);
    return result;
}

bool helix_screen_recording_preflight(void) {
    return CGPreflightScreenCaptureAccess();
}

bool helix_screen_recording_request(void) {
    return CGRequestScreenCaptureAccess();
}

bool helix_accessibility_trusted(void) {
    return AXIsProcessTrusted();
}

bool helix_request_accessibility(void) {
    NSDictionary *options = @{(__bridge NSString *)kAXTrustedCheckOptionPrompt: @YES};
    return AXIsProcessTrustedWithOptions((__bridge CFDictionaryRef)options);
}

int helix_notification_state(void) {
    dispatch_semaphore_t semaphore = dispatch_semaphore_create(0);
    __block NSInteger status = UNAuthorizationStatusNotDetermined;
    [UNUserNotificationCenter.currentNotificationCenter getNotificationSettingsWithCompletionHandler:^(UNNotificationSettings *settings) {
        status = settings.authorizationStatus;
        dispatch_semaphore_signal(semaphore);
    }];
    dispatch_semaphore_wait(semaphore, dispatch_time(DISPATCH_TIME_NOW, 2 * NSEC_PER_SEC));
    return (int)status;
}

bool helix_request_notifications(void) {
    dispatch_semaphore_t semaphore = dispatch_semaphore_create(0);
    __block BOOL granted = NO;
    [UNUserNotificationCenter.currentNotificationCenter requestAuthorizationWithOptions:(UNAuthorizationOptionAlert | UNAuthorizationOptionSound | UNAuthorizationOptionBadge) completionHandler:^(BOOL accepted, NSError *error) {
        granted = accepted && error == nil;
        dispatch_semaphore_signal(semaphore);
    }];
    dispatch_semaphore_wait(semaphore, dispatch_time(DISPATCH_TIME_NOW, 5 * NSEC_PER_SEC));
    return granted;
}

bool helix_send_notification(const char *title, const char *body) {
    if (!title || !body) return false;
    dispatch_semaphore_t semaphore = dispatch_semaphore_create(0);
    __block BOOL accepted = NO;
    UNMutableNotificationContent *content = [UNMutableNotificationContent new];
    content.title = [NSString stringWithUTF8String:title] ?: @"Helix";
    content.body = [NSString stringWithUTF8String:body] ?: @"";
    UNNotificationRequest *request = [UNNotificationRequest requestWithIdentifier:NSUUID.UUID.UUIDString content:content trigger:nil];
    [UNUserNotificationCenter.currentNotificationCenter addNotificationRequest:request withCompletionHandler:^(NSError *error) {
        accepted = error == nil;
        dispatch_semaphore_signal(semaphore);
    }];
    dispatch_semaphore_wait(semaphore, dispatch_time(DISPATCH_TIME_NOW, 2 * NSEC_PER_SEC));
    return accepted;
}

@interface HelixStreamOutput : NSObject <SCStreamOutput>
@property(nonatomic) dispatch_semaphore_t semaphore;
@property(nonatomic) CGImageRef image;
@end

@implementation HelixStreamOutput
- (void)stream:(SCStream *)stream didOutputSampleBuffer:(CMSampleBufferRef)sampleBuffer ofType:(SCStreamOutputType)type {
    (void)stream;
    if (type != SCStreamOutputTypeScreen || self.image) return;
    CVPixelBufferRef buffer = CMSampleBufferGetImageBuffer(sampleBuffer);
    if (!buffer) return;
    CIImage *ciImage = [CIImage imageWithCVPixelBuffer:buffer];
    CGImageRef image = [[CIContext contextWithOptions:nil] createCGImage:ciImage fromRect:ciImage.extent];
    if (!image) return;
    self.image = image;
    dispatch_semaphore_signal(self.semaphore);
}
- (void)dealloc {
    if (_image) CGImageRelease(_image);
}
@end

static CGImageRef helix_capture_display_sckit(uint32_t display_id) {
    dispatch_semaphore_t contentSemaphore = dispatch_semaphore_create(0);
    __block SCShareableContent *content = nil;
    [SCShareableContent getShareableContentExcludingDesktopWindows:YES onScreenWindowsOnly:YES completionHandler:^(SCShareableContent *value, NSError *error) {
        if (!error) content = value;
        dispatch_semaphore_signal(contentSemaphore);
    }];
    if (dispatch_semaphore_wait(contentSemaphore, dispatch_time(DISPATCH_TIME_NOW, 2 * NSEC_PER_SEC)) != 0 || !content) return NULL;

    SCDisplay *display = nil;
    for (SCDisplay *candidate in content.displays) {
        if (candidate.displayID == display_id) { display = candidate; break; }
    }
    if (!display) return NULL;

    SCContentFilter *filter = [[SCContentFilter alloc] initWithDisplay:display excludingWindows:@[]];
    SCStreamConfiguration *configuration = [SCStreamConfiguration new];
    configuration.width = (size_t)display.width;
    configuration.height = (size_t)display.height;
    configuration.pixelFormat = kCVPixelFormatType_32BGRA;
    configuration.showsCursor = NO;
    configuration.capturesAudio = NO;
    configuration.queueDepth = 3;

    HelixStreamOutput *output = [HelixStreamOutput new];
    output.semaphore = dispatch_semaphore_create(0);
    SCStream *stream = [[SCStream alloc] initWithFilter:filter configuration:configuration delegate:nil];
    NSError *error = nil;
    if (![stream addStreamOutput:output type:SCStreamOutputTypeScreen sampleHandlerQueue:dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0) error:&error]) return NULL;
    dispatch_semaphore_t startSemaphore = dispatch_semaphore_create(0);
    [stream startCaptureWithCompletionHandler:^(NSError *startError) { (void)startError; dispatch_semaphore_signal(startSemaphore); }];
    if (dispatch_semaphore_wait(startSemaphore, dispatch_time(DISPATCH_TIME_NOW, 2 * NSEC_PER_SEC)) != 0) return NULL;
    if (dispatch_semaphore_wait(output.semaphore, dispatch_time(DISPATCH_TIME_NOW, 2 * NSEC_PER_SEC)) != 0 || !output.image) return NULL;
    CGImageRef image = CGImageCreateCopy(output.image);
    [stream stopCaptureWithCompletionHandler:nil];
    return image;
}

int helix_capture_display(uint32_t display_id, uint8_t **bytes, size_t *length, uint32_t *width, uint32_t *height) {
    if (!bytes || !length || !width || !height) return 0;
    CGImageRef image = helix_capture_display_sckit(display_id);
    if (!image) return 0;

    *width = (uint32_t)CGImageGetWidth(image);
    *height = (uint32_t)CGImageGetHeight(image);
    CFMutableDataRef data = CFDataCreateMutable(NULL, 0);
    CGImageDestinationRef destination = CGImageDestinationCreateWithData(data, CFSTR("public.png"), 1, NULL);
    if (!data || !destination) {
        if (destination) CFRelease(destination);
        if (data) CFRelease(data);
        CGImageRelease(image);
        return 0;
    }

    CGImageDestinationAddImage(destination, image, NULL);
    const bool finalized = CGImageDestinationFinalize(destination);
    if (finalized) {
        *length = (size_t)CFDataGetLength(data);
        *bytes = malloc(*length);
        if (!*bytes) *length = 0;
        else memcpy(*bytes, CFDataGetBytePtr(data), *length);
    }

    CFRelease(destination);
    CFRelease(data);
    CGImageRelease(image);
    return finalized && *bytes != NULL;
}

void helix_free_bytes(uint8_t *bytes) {
    free(bytes);
}

int helix_make_preview(const uint8_t *bytes, size_t length, uint32_t max_dimension, uint8_t **preview_bytes, size_t *preview_length) {
    if (!bytes || length == 0 || !preview_bytes || !preview_length) return 0;
    *preview_bytes = NULL;
    *preview_length = 0;
    CFDataRef data = CFDataCreate(NULL, bytes, (CFIndex)length);
    CGImageSourceRef source = data ? CGImageSourceCreateWithData(data, NULL) : NULL;
    NSDictionary *options = @{
        (id)kCGImageSourceCreateThumbnailFromImageAlways: @YES,
        (id)kCGImageSourceCreateThumbnailWithTransform: @YES,
        (id)kCGImageSourceThumbnailMaxPixelSize: @(max_dimension),
    };
    CGImageRef thumbnail = source ? CGImageSourceCreateThumbnailAtIndex(source, 0, (__bridge CFDictionaryRef)options) : NULL;
    CFMutableDataRef output = thumbnail ? CFDataCreateMutable(NULL, 0) : NULL;
    CGImageDestinationRef destination = output ? CGImageDestinationCreateWithData(output, CFSTR("public.png"), 1, NULL) : NULL;
    BOOL finalized = NO;
    if (destination && thumbnail) {
        CGImageDestinationAddImage(destination, thumbnail, NULL);
        finalized = CGImageDestinationFinalize(destination);
    }
    if (finalized) {
        *preview_length = (size_t)CFDataGetLength(output);
        *preview_bytes = malloc(*preview_length);
        if (*preview_bytes) memcpy(*preview_bytes, CFDataGetBytePtr(output), *preview_length);
        else *preview_length = 0;
    }
    if (destination) CFRelease(destination);
    if (output) CFRelease(output);
    if (thumbnail) CGImageRelease(thumbnail);
    if (source) CFRelease(source);
    if (data) CFRelease(data);
    return finalized && *preview_bytes != NULL;
}

void helix_free_string(char *value) {
    free(value);
}

static NSDictionary *helix_box(NSRect box) {
    return @{
        @"x": @(box.origin.x),
        @"y": @(1.0 - box.origin.y - box.size.height),
        @"width": @(box.size.width),
        @"height": @(box.size.height),
    };
}

char *helix_analyze_image(const uint8_t *bytes, size_t length, const char *feature_list, double crop_x, double crop_y, double crop_width, double crop_height) {
    if (!bytes || length == 0) return NULL;
    NSData *data = [NSData dataWithBytes:bytes length:length];
    VNImageRequestHandler *handler = [[VNImageRequestHandler alloc] initWithData:data options:@{}];
    NSMutableDictionary *result = [@{
        @"processedOnDevice": @YES,
        @"features": @[],
        @"text": @{ @"content": @"", @"observations": @[], @"truncated": @NO },
        @"classifications": @[],
        @"barcodes": @[],
        @"saliency": @{ @"boundingBoxes": @[] },
    } mutableCopy];
    NSMutableArray *features = [NSMutableArray array];
    NSString *requested = feature_list ? [NSString stringWithUTF8String:feature_list] : @"text";
    CGRect region = CGRectMake(crop_x >= 0.0 ? crop_x : 0.0, crop_y >= 0.0 ? 1.0 - crop_y - crop_height : 0.0, crop_width >= 0.0 ? crop_width : 1.0, crop_height >= 0.0 ? crop_height : 1.0);

    if ([requested containsString:@"text"]) {
        VNRecognizeTextRequest *request = [[VNRecognizeTextRequest alloc] init];
        request.regionOfInterest = region;
        request.recognitionLevel = VNRequestTextRecognitionLevelAccurate;
        request.usesLanguageCorrection = NO;
        if ([handler performRequests:@[request] error:nil]) {
            NSMutableArray *observations = [NSMutableArray array];
            NSMutableArray *lines = [NSMutableArray array];
            for (VNRecognizedTextObservation *observation in request.results) {
                VNRecognizedText *candidate = [[observation topCandidates:1] firstObject];
                if (!candidate) continue;
                [lines addObject:candidate.string];
                [observations addObject:@{
                    @"text": candidate.string,
                    @"confidence": @(candidate.confidence),
                    @"boundingBox": helix_box(observation.boundingBox),
                }];
            }
            result[@"text"] = @{
                @"content": [lines componentsJoinedByString:@"\n"],
                @"observations": observations,
                @"truncated": @NO,
            };
        }
        [features addObject:@"text"];
    }

    if ([requested containsString:@"classification"]) {
        VNClassifyImageRequest *request = [[VNClassifyImageRequest alloc] init];
        request.regionOfInterest = region;
        if ([handler performRequests:@[request] error:nil]) {
            NSMutableArray *items = [NSMutableArray array];
            for (VNClassificationObservation *observation in [request.results subarrayWithRange:NSMakeRange(0, MIN(10, request.results.count))]) {
                [items addObject:@{ @"identifier": observation.identifier, @"confidence": @(observation.confidence) }];
            }
            result[@"classifications"] = items;
        }
        [features addObject:@"classification"];
    }

    if ([requested containsString:@"barcode"]) {
        VNDetectBarcodesRequest *request = [[VNDetectBarcodesRequest alloc] init];
        request.regionOfInterest = region;
        if ([handler performRequests:@[request] error:nil]) {
            NSMutableArray *items = [NSMutableArray array];
            for (VNBarcodeObservation *observation in [request.results subarrayWithRange:NSMakeRange(0, MIN(50, request.results.count))]) {
                NSMutableDictionary *item = [@{
                    @"symbology": observation.symbology ?: @"unknown",
                    @"confidence": @(observation.confidence),
                    @"boundingBox": helix_box(observation.boundingBox),
                } mutableCopy];
                if (observation.payloadStringValue) item[@"payload"] = observation.payloadStringValue;
                [items addObject:item];
            }
            result[@"barcodes"] = items;
        }
        [features addObject:@"barcode"];
    }

    if ([requested containsString:@"saliency"]) {
        VNGenerateAttentionBasedSaliencyImageRequest *request = [[VNGenerateAttentionBasedSaliencyImageRequest alloc] init];
        request.regionOfInterest = region;
        if ([handler performRequests:@[request] error:nil]) {
            VNSaliencyImageObservation *observation = [request.results firstObject];
            NSMutableArray *boxes = [NSMutableArray array];
            for (VNRectangleObservation *box in observation.salientObjects ?: @[]) {
                [boxes addObject:helix_box(box.boundingBox)];
            }
            result[@"saliency"] = @{ @"boundingBoxes": boxes };
        }
        [features addObject:@"saliency"];
    }

    result[@"features"] = features;
    return helix_json_copy(result);
}

char *helix_system_context(void) {
    NSMutableArray *screens = [NSMutableArray array];
    for (NSScreen *screen in NSScreen.screens) {
        NSDictionary *description = screen.deviceDescription;
        NSNumber *displayId = description[@"NSScreenNumber"];
        NSRect frame = screen.frame;
        CGFloat scale = screen.backingScaleFactor;
        [screens addObject:@{
            @"id": displayId ?: @0,
            @"width": @((NSUInteger)frame.size.width),
            @"height": @((NSUInteger)frame.size.height),
            @"scaleFactor": @(scale),
        }];
    }
    return helix_json_copy(@{
        @"osVersion": NSProcessInfo.processInfo.operatingSystemVersionString ?: @"macOS",
        @"architecture": @"apple",
        @"locale": NSLocale.currentLocale.localeIdentifier ?: @"",
        @"timezone": NSTimeZone.localTimeZone.name ?: @"",
        @"displays": screens,
    });
}

static NSString *helix_ax_string(AXUIElementRef element, CFStringRef attribute) {
    CFTypeRef value = NULL;
    if (AXUIElementCopyAttributeValue(element, attribute, &value) != kAXErrorSuccess || !value) return @"";
    NSString *result = [(__bridge id)value isKindOfClass:NSString.class] ? (__bridge NSString *)value : @"";
    NSString *copy = [result copy];
    CFRelease(value);
    return copy;
}

static NSRunningApplication *helix_last_external_application = nil;
static dispatch_once_t helix_tracking_once;

static void helix_remember_external_application(NSRunningApplication *application) {
    NSString *bundleId = application.bundleIdentifier ?: @"";
    NSString *ownBundleId = NSBundle.mainBundle.bundleIdentifier ?: @"";
    if (bundleId.length == 0 || [bundleId isEqualToString:ownBundleId]) return;
    @synchronized ([NSWorkspace class]) {
        helix_last_external_application = application;
    }
}

void helix_start_app_tracking(void) {
    dispatch_once(&helix_tracking_once, ^{
        helix_remember_external_application(NSWorkspace.sharedWorkspace.frontmostApplication);
        [[NSNotificationCenter defaultCenter]
            addObserverForName:NSWorkspaceDidActivateApplicationNotification
                        object:NSWorkspace.sharedWorkspace
                         queue:[NSOperationQueue mainQueue]
                    usingBlock:^(NSNotification *notification) {
                        NSRunningApplication *application = notification.userInfo[NSWorkspaceApplicationKey];
                        if (application) helix_remember_external_application(application);
                    }];
    });
}

static NSRunningApplication *helix_target_application(void) {
    helix_start_app_tracking();
    @synchronized ([NSWorkspace class]) {
        return helix_last_external_application;
    }
}

static BOOL helix_ax_hidden(AXUIElementRef element) {
    CFTypeRef value = NULL;
    BOOL hidden = AXUIElementCopyAttributeValue(element, kAXHiddenAttribute, &value) == kAXErrorSuccess &&
                  value && CFGetTypeID(value) == CFBooleanGetTypeID() && CFBooleanGetValue(value);
    if (value) CFRelease(value);
    return hidden;
}

static BOOL helix_ax_frame(AXUIElementRef element, NSRect *frame) {
    CFTypeRef position = NULL;
    CFTypeRef size = NULL;
    BOOL valid = AXUIElementCopyAttributeValue(element, kAXPositionAttribute, &position) == kAXErrorSuccess &&
                 AXUIElementCopyAttributeValue(element, kAXSizeAttribute, &size) == kAXErrorSuccess;
    CGPoint point = CGPointZero;
    CGSize dimensions = CGSizeZero;
    valid = valid && position && size && AXValueGetType(position) == kAXValueCGPointType &&
            AXValueGetType(size) == kAXValueCGSizeType && AXValueGetValue(position, kAXValueCGPointType, &point) &&
            AXValueGetValue(size, kAXValueCGSizeType, &dimensions) && dimensions.width > 0 && dimensions.height > 0;
    if (valid && frame) *frame = NSMakeRect(point.x, point.y, dimensions.width, dimensions.height);
    if (position) CFRelease(position);
    if (size) CFRelease(size);
    return valid;
}

typedef struct {
    NSRect windowFrame;
    CFAbsoluteTime deadline;
    NSMutableArray *elements;
    NSMutableArray *lines;
    NSUInteger characters;
    NSUInteger nodes;
    BOOL truncated;
} HelixAXWalkContext;

static NSDictionary *helix_ax_normalized_frame(NSRect frame, NSRect windowFrame) {
    if (windowFrame.size.width <= 0 || windowFrame.size.height <= 0) return nil;
    CGFloat x = (frame.origin.x - windowFrame.origin.x) / windowFrame.size.width;
    CGFloat y = (frame.origin.y - windowFrame.origin.y) / windowFrame.size.height;
    CGFloat width = frame.size.width / windowFrame.size.width;
    CGFloat height = frame.size.height / windowFrame.size.height;
    x = MAX(0.0, MIN(1.0, x));
    y = MAX(0.0, MIN(1.0, y));
    width = MAX(0.0, MIN(1.0 - x, width));
    height = MAX(0.0, MIN(1.0 - y, height));
    return @{ @"x": @(x), @"y": @(y), @"width": @(width), @"height": @(height) };
}

static void helix_ax_walk(AXUIElementRef element, NSUInteger depth, HelixAXWalkContext *context) {
    if (!element || depth > 12 || context->nodes >= 750 || context->characters >= 50000 ||
        CFAbsoluteTimeGetCurrent() > context->deadline) {
        context->truncated = YES;
        return;
    }
    context->nodes += 1;

    NSString *role = helix_ax_string(element, kAXRoleAttribute);
    if ([role isEqualToString:@"AXSecureTextField"] || helix_ax_hidden(element)) return;

    NSRect frame = NSZeroRect;
    BOOL hasFrame = helix_ax_frame(element, &frame);
    BOOL visible = hasFrame && NSIntersectsRect(frame, context->windowFrame);
    NSString *label = helix_ax_string(element, kAXDescriptionAttribute);
    if (label.length == 0) label = helix_ax_string(element, kAXTitleAttribute);
    NSString *value = helix_ax_string(element, kAXValueAttribute);
    NSString *text = value.length > 0 ? value : label;
    if (visible && text.length > 0) {
        NSUInteger remaining = 50000 - context->characters;
        NSString *bounded = text.length > remaining ? [text substringToIndex:remaining] : text;
        if (![bounded isEqualToString:context->lines.lastObject]) {
            [context->lines addObject:bounded];
            context->characters += bounded.length + 1;
        }
        NSMutableDictionary *elementResult = [@{ @"role": role ?: @"", @"text": bounded } mutableCopy];
        if (label.length > 0) elementResult[@"label"] = label;
        if (value.length > 0) elementResult[@"value"] = bounded;
        NSDictionary *normalized = helix_ax_normalized_frame(frame, context->windowFrame);
        if (normalized) elementResult[@"frame"] = normalized;
        NSDictionary *last = context->elements.lastObject;
        if (!last || ![last[@"text"] isEqualToString:bounded] || ![last[@"role"] isEqualToString:role]) {
            [context->elements addObject:elementResult];
        }
        if (text.length > remaining) context->truncated = YES;
    }

    CFTypeRef children = NULL;
    if (AXUIElementCopyAttributeValue(element, kAXChildrenAttribute, &children) != kAXErrorSuccess || !children ||
        CFGetTypeID(children) != CFArrayGetTypeID()) {
        if (children) CFRelease(children);
        return;
    }
    CFArrayRef childArray = (CFArrayRef)children;
    for (CFIndex index = 0; index < CFArrayGetCount(childArray); index++) {
        helix_ax_walk((AXUIElementRef)CFArrayGetValueAtIndex(childArray, index), depth + 1, context);
        if (context->truncated && (context->nodes >= 750 || context->characters >= 50000 || CFAbsoluteTimeGetCurrent() > context->deadline)) break;
    }
    CFRelease(children);
}

char *helix_active_window_context(void) {
    NSRunningApplication *application = helix_target_application();
    if (!application) return NULL;
    pid_t pid = application.processIdentifier;
    AXUIElementRef app = AXUIElementCreateApplication(pid);
    if (!app) return NULL;
    CFTypeRef focused = NULL;
    AXUIElementCopyAttributeValue(app, kAXFocusedWindowAttribute, &focused);
    AXUIElementRef window = (AXUIElementRef)focused;
    if (!window) {
        CFRelease(app);
        return NULL;
    }
    NSString *title = window ? helix_ax_string(window, kAXTitleAttribute) : @"";
    NSRect windowFrame = NSZeroRect;
    if (!helix_ax_frame(window, &windowFrame)) {
        if (focused) CFRelease(focused);
        CFRelease(app);
        return NULL;
    }
    HelixAXWalkContext context = {
        .windowFrame = windowFrame,
        .deadline = CFAbsoluteTimeGetCurrent() + 2.0,
        .elements = [NSMutableArray arrayWithCapacity:64],
        .lines = [NSMutableArray arrayWithCapacity:64],
        .characters = 0,
        .nodes = 0,
        .truncated = NO,
    };
    helix_ax_walk(window, 0, &context);
    NSString *value = [context.lines componentsJoinedByString:@"\n"];
    NSDictionary *result = @{
        @"appName": application.localizedName ?: @"",
        @"bundleId": application.bundleIdentifier ?: @"",
        @"pid": @(pid),
        @"windowTitle": title,
        @"content": value,
        @"elements": context.elements,
        @"nodeCount": @(context.nodes),
        @"truncated": @(context.truncated),
        @"redactedCount": @0,
        @"capturedAt": [[NSISO8601DateFormatter new] stringFromDate:NSDate.date],
    };
    if (focused) CFRelease(focused);
    CFRelease(app);
    return helix_json_copy(result);
}
