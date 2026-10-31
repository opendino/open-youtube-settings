# Mağaza yayını: ilk yükleme ve anahtarlar

İlk yükleme her iki mağazada da elle yapılır. Sonraki sürümleri *Actions → Publish to stores* yükler.

Yüklenecek zip'ler [Releases](../../../releases/latest) sayfasında:

- `open-youtube-settings-chrome-vX.zip`
- `open-youtube-settings-firefox-vX.zip`

Görseller bu klasörde hazır:

| Ne | Dosya | Boyut |
| --- | --- | --- |
| Ekran görüntüleri (EN) | `docs/images/en/1-hero.jpg` … `7-layout.jpg` | 1280×800 |
| Ekran görüntüleri (TR) | `docs/images/tr/1-hero.jpg` … `7-layout.jpg` | 1280×800 |
| Küçük tanıtım kutusu (Chrome) | `docs/images/en/promo-tile-440x280.jpg` | 440×280 |
| Simge | `icon_128.png` | 128×128 |

---

## 1. Chrome Web Mağazası

### İlk yükleme
1. https://chrome.google.com/webstore/devconsole adresinde geliştirici hesabı aç (tek seferlik 5 $).
2. **New item** → Chrome zip'ini yükle.
3. **Store listing** sekmesi:
   - Açıklama: aşağıdaki *Uzun açıklama* metni.
   - Kategori: **Productivity** (Verimlilik) ya da **Tools**.
   - Dil: English. İstersen Türkçe listeyi ayrıca ekle.
   - Ekran görüntüleri: `docs/images/en/` içindeki 7 görsel.
   - Small promo tile: `promo-tile-440x280.jpg`.
4. **Privacy** sekmesi:
   - *Single purpose:* "Adds playback, colour, crop, clip and layout controls to YouTube's own player and pages."
   - *storage justification:* "Saves the user's settings, shortcuts and blocked channels locally."
   - *Host permission (youtube.com) justification:* "The extension only runs on YouTube pages to change the player and the page layout."
   - *Remote code:* **No, I am not using remote code.**
   - *Data usage:* hiçbir kutuyu işaretleme. Alttaki üç beyanı onayla.
   - *Privacy policy URL:* veri toplanmadığı için zorunlu değil. İstenirse README'nin Gizlilik bölümüne bağlantı ver.
5. **Submit for review**.

### Otomatik yükleme için anahtarlar
GitHub'da *Settings → Secrets and variables → Actions → New repository secret* ile şunları ekle:

| Secret | Nereden |
| --- | --- |
| `CHROME_EXTENSION_ID` | Geliştirici panelinde eklentinin 32 harflik kimliği |
| `CHROME_PUBLISHER_ID` | Geliştirici panelinde *Account* sayfasındaki Publisher ID |
| `CHROME_CLIENT_ID`, `CHROME_CLIENT_SECRET`, `CHROME_REFRESH_TOKEN` | Google Cloud'da Chrome Web Store API için OAuth istemcisi. Adım adım rehber: https://github.com/fregante/chrome-webstore-upload-keys |

## 2. Firefox Eklentileri (AMO)

### İlk yükleme
1. https://addons.mozilla.org/developers/ adresinde giriş yap → **Submit a New Add-on**.
2. **On this site** (listelenmiş) seçeneğini seç ve Firefox zip'ini yükle.
3. Kaynak kodu sorusu: kod küçültülmemiş (minified değil), **No** de.
4. Açıklama: aşağıdaki metin. Kategori: **Photos, Music & Videos** ya da **Appearance**. Ekran görüntüleri: `docs/images/en/`.
5. Lisans: istediğin lisansı seç.

### Otomatik yükleme için anahtarlar
https://addons.mozilla.org/developers/addon/api/key/ sayfasında **Generate new credentials** ile:

| Secret | Değer |
| --- | --- |
| `AMO_API_KEY` | JWT issuer (`user:12345:67` gibi) |
| `AMO_API_SECRET` | JWT secret |

## 3. Sonraki sürümler
1. `manifest.json` ve `package.json` içindeki sürümü yükselt.
2. `git tag vX.Y && git push origin vX.Y` komutunu çalıştır. Testler çalışır, ardından GitHub Release oluşur.
3. *Actions → Publish to stores → Run workflow*. Etiketi boş bırakırsan son sürüm yüklenir.

---

## Mağaza metinleri

### Kısa açıklama
Mağazalar bunu eklentinin içinden (`appDesc`) her dil için otomatik alır.

> Speed control, colour filters, video crop, clips, Shorts blocking and channel blocking for YouTube — right in the player.

### Uzun açıklama (English)

```
Open Youtube Settings puts the controls you wish YouTube had right into its own player.

BLOCK CHANNELS
• Hover over a recommended video and press 🚫 — every video from that channel is covered on home, search and the end screen.
• Unblock any time from the popup.

SPEED
• The current speed sits in YouTube's control bar — click it for presets and fine steps.
• A default speed for every video, or keep the last one between videos.
• Your own keyboard shortcuts to speed up, slow down and reset.

CROP
• Drag over the video like taking a screenshot; it keeps playing, zoomed to fit or fill the player.
• One click shows the whole video again.

CLIPS
• Mark a start and an end, preview the loop and save it as a video file.

COLOUR
• Brightness, blue-light filter and colour inversion, with shortcuts to adjust them.

A CALMER YOUTUBE
• Turn off Shorts completely — shelves, search results, menu entry and channel tab.
• Hide the home feed, the sidebar or the playlist.
• Block channels from recommendations with one click.
• Mute ads automatically; the sound returns when the ad ends.
• Open channels straight on their Videos tab.

ALSO
• One switch turns everything off.
• Search across all settings.
• Light, dark or automatic appearance.
• English, Türkçe, Deutsch, Español, Français, हिन्दी, 日本語, Português (Brasil).

PRIVACY
No data is collected or sent anywhere. Settings stay in your browser.
```

### Uzun açıklama (Türkçe)

```
Open Youtube Ayarları, YouTube'da olmasını istediğin kontrolleri doğrudan oynatıcıya getirir.

KANAL ENGELLEME
• Önerilen bir videonun üzerine gel ve 🚫 düğmesine bas — o kanalın tüm videoları ana sayfada, aramada ve video sonunda örtülür.
• Engeli istediğin zaman eklenti penceresinden kaldır.

HIZ
• Geçerli hız YouTube'un kontrol çubuğunda — tıkla, hazır hızlardan ve ince adımlardan seç.
• Her video için varsayılan hız ya da son hızı videolar arasında koruma.
• Hızlandırma, yavaşlatma ve sıfırlama için kendi klavye kısayolların.

KIRPMA
• Ekran görüntüsü alır gibi videoda alan seç; video oynamaya devam eder, oynatıcıya sığar ya da doldurur.
• Tek tıkla videonun tamamına geri dön.

KLİP
• Başlangıç ve bitişi işaretle, döngüde önizle, video dosyası olarak kaydet.

RENK
• Parlaklık, mavi ışık filtresi ve renkleri tersine çevirme; kısayollarla ayarlanabilir.

DAHA SAKİN BİR YOUTUBE
• Shorts'u tamamen kapat — raflar, arama sonuçları, menü girişi ve kanal sekmesi.
• Ana sayfa akışını, kenar çubuğunu ya da oynatma listesini gizle.
• Önerilerdeki kanalları tek tıkla engelle.
• Reklamların sesini otomatik kapat; reklam bitince ses geri gelir.
• Kanalları doğrudan Videolar sekmesinde aç.

AYRICA
• Tek düğmeyle her şeyi kapat.
• Tüm ayarlarda arama.
• Açık, koyu ya da otomatik görünüm.
• 8 dil desteği.

GİZLİLİK
Hiçbir veri toplanmaz ve hiçbir yere gönderilmez. Ayarlar tarayıcında kalır.
```
