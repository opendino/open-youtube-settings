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
   - Dil: English (varsayılan). Diğer diller için aşağıdaki *Diller* bölümüne bak.
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

### Diller
Mağaza, sayfayı kullanıcının Chrome dil ayarına göre gösterir. Kendi metni olmayan dillerde varsayılan dil (English) görünür.

- **Ad ve kısa açıklama:** eklentinin `_locales` klasöründen otomatik gelir. 8 dil hazır: en, tr, de, es, fr, hi, ja, pt_BR.
- **Uzun açıklama:** *Mağaza girişi* sayfasının üstündeki *Dil* menüsünden dili seç ve aşağıdaki metinlerden o dilinkini yapıştır. Her dil için ayrı ayrı yapılır.
- **Ekran görüntüleri:** *Yerelleştirilmiş ekran görüntüleri* boş kalan dillerde *Genel ekran görüntüleri* gösterilir. EN ve TR için hazır görseller var (`docs/images/en`, `docs/images/tr`).
- **Yeni bir dil** (örneğin İtalyanca, Çince): önce eklentiye `_locales/<dil>` eklenip yeni sürüm çıkmalı. Yoksa o dilde ad ve kısa açıklama İngilizce kalır.

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

### Uzun açıklama (Deutsch)

```
Open Youtube Einstellungen bringt die Steuerelemente, die YouTube fehlen, direkt in den eigenen Player.

KANÄLE BLOCKIEREN
• Fahre mit der Maus über ein empfohlenes Video und drücke 🚫 – alle Videos dieses Kanals werden auf der Startseite, in der Suche und im Abspann verdeckt.
• Die Sperre lässt sich jederzeit im Popup aufheben.

GESCHWINDIGKEIT
• Die aktuelle Geschwindigkeit steht in der Steuerleiste von YouTube – ein Klick öffnet Voreinstellungen und feine Schritte.
• Eine Standardgeschwindigkeit für jedes Video oder die letzte Geschwindigkeit zwischen Videos beibehalten.
• Eigene Tastenkürzel zum Beschleunigen, Verlangsamen und Zurücksetzen.

ZUSCHNEIDEN
• Ziehe wie bei einem Screenshot einen Bereich über das Video; es läuft weiter und wird in den Player eingepasst oder füllt ihn aus.
• Ein Klick zeigt wieder das ganze Video.

CLIPS
• Start und Ende markieren, die Schleife ansehen und als Videodatei speichern.

FARBE
• Helligkeit, Blaulichtfilter und Farben umkehren, mit Tastenkürzeln einstellbar.

EIN RUHIGERES YOUTUBE
• Shorts komplett ausschalten – Regale, Suchergebnisse, Menüeintrag und Kanal-Tab.
• Startseite, Seitenleiste oder Playlist ausblenden.
• Kanäle mit einem Klick aus den Empfehlungen blockieren.
• Werbung automatisch stummschalten; der Ton kommt zurück, sobald die Werbung endet.
• Kanäle direkt im Tab „Videos“ öffnen.

AUSSERDEM
• Ein Schalter schaltet alles aus.
• Suche in allen Einstellungen.
• Helles, dunkles oder automatisches Design.
• English, Türkçe, Deutsch, Español, Français, हिन्दी, 日本語, Português (Brasil).

DATENSCHUTZ
Es werden keine Daten gesammelt oder irgendwohin gesendet. Die Einstellungen bleiben in deinem Browser.
```

### Uzun açıklama (Español)

```
Ajustes de Open Youtube lleva al propio reproductor de YouTube los controles que te gustaría que tuviera.

BLOQUEAR CANALES
• Pasa el ratón sobre un vídeo recomendado y pulsa 🚫: todos los vídeos de ese canal quedan cubiertos en la página de inicio, en la búsqueda y en la pantalla final.
• Desbloquéalo cuando quieras desde la ventana de la extensión.

VELOCIDAD
• La velocidad actual aparece en la barra de controles de YouTube: haz clic para ver velocidades predefinidas y pasos finos.
• Una velocidad predeterminada para cada vídeo, o mantener la última entre vídeos.
• Tus propios atajos de teclado para acelerar, ralentizar y restablecer.

RECORTE
• Arrastra sobre el vídeo como si hicieras una captura de pantalla; sigue reproduciéndose, ajustado al reproductor o llenándolo.
• Un clic vuelve a mostrar el vídeo completo.

CLIPS
• Marca un inicio y un final, previsualiza el bucle y guárdalo como archivo de vídeo.

COLOR
• Brillo, filtro de luz azul e inversión de colores, con atajos para ajustarlos.

UN YOUTUBE MÁS TRANQUILO
• Desactiva los Shorts por completo: estanterías, resultados de búsqueda, entrada del menú y pestaña del canal.
• Oculta el feed de inicio, la barra lateral o la lista de reproducción.
• Bloquea canales de las recomendaciones con un clic.
• Silencia los anuncios automáticamente; el sonido vuelve cuando termina el anuncio.
• Abre los canales directamente en su pestaña Vídeos.

ADEMÁS
• Un solo interruptor lo desactiva todo.
• Búsqueda en todos los ajustes.
• Apariencia clara, oscura o automática.
• English, Türkçe, Deutsch, Español, Français, हिन्दी, 日本語, Português (Brasil).

PRIVACIDAD
No se recopila ni se envía ningún dato. Los ajustes se quedan en tu navegador.
```

### Uzun açıklama (Français)

```
Paramètres Open Youtube ajoute directement dans le lecteur de YouTube les commandes qui lui manquent.

BLOQUER DES CHAÎNES
• Survolez une vidéo recommandée et appuyez sur 🚫 : toutes les vidéos de cette chaîne sont masquées sur l'accueil, dans la recherche et sur l'écran de fin.
• Débloquez-la à tout moment depuis la fenêtre de l'extension.

VITESSE
• La vitesse actuelle s'affiche dans la barre de commandes de YouTube : cliquez pour les vitesses prédéfinies et les réglages fins.
• Une vitesse par défaut pour chaque vidéo, ou la dernière vitesse conservée d'une vidéo à l'autre.
• Vos propres raccourcis clavier pour accélérer, ralentir et réinitialiser.

RECADRAGE
• Sélectionnez une zone de la vidéo comme pour une capture d'écran ; elle continue de jouer, ajustée au lecteur ou en le remplissant.
• Un clic réaffiche la vidéo entière.

CLIPS
• Marquez un début et une fin, prévisualisez la boucle et enregistrez-la en fichier vidéo.

COULEUR
• Luminosité, filtre anti-lumière bleue et inversion des couleurs, avec des raccourcis pour les régler.

UN YOUTUBE PLUS CALME
• Désactivez complètement les Shorts : étagères, résultats de recherche, entrée du menu et onglet de la chaîne.
• Masquez le flux d'accueil, la barre latérale ou la playlist.
• Bloquez des chaînes dans les recommandations en un clic.
• Coupez automatiquement le son des publicités ; il revient dès la fin de la publicité.
• Ouvrez les chaînes directement sur leur onglet Vidéos.

ET AUSSI
• Un seul interrupteur désactive tout.
• Recherche dans tous les réglages.
• Apparence claire, sombre ou automatique.
• English, Türkçe, Deutsch, Español, Français, हिन्दी, 日本語, Português (Brasil).

CONFIDENTIALITÉ
Aucune donnée n'est collectée ni envoyée. Vos réglages restent dans votre navigateur.
```

### Uzun açıklama (Português – Brasil)

```
Configurações do Open Youtube coloca no próprio player do YouTube os controles que você gostaria que ele tivesse.

BLOQUEAR CANAIS
• Passe o mouse sobre um vídeo recomendado e clique em 🚫 — todos os vídeos desse canal ficam cobertos na página inicial, na busca e na tela final.
• Desbloqueie quando quiser pela janela da extensão.

VELOCIDADE
• A velocidade atual fica na barra de controles do YouTube — clique para ver velocidades prontas e ajustes finos.
• Uma velocidade padrão para todos os vídeos, ou manter a última entre um vídeo e outro.
• Seus próprios atalhos de teclado para acelerar, desacelerar e redefinir.

RECORTE
• Arraste sobre o vídeo como numa captura de tela; ele continua tocando, ajustado ao player ou preenchendo-o.
• Um clique mostra o vídeo inteiro de novo.

CLIPES
• Marque o início e o fim, veja o loop e salve como arquivo de vídeo.

COR
• Brilho, filtro de luz azul e inversão de cores, com atalhos para ajustar.

UM YOUTUBE MAIS TRANQUILO
• Desative os Shorts por completo — prateleiras, resultados de busca, item do menu e aba do canal.
• Oculte o feed inicial, a barra lateral ou a playlist.
• Bloqueie canais das recomendações com um clique.
• Silencie anúncios automaticamente; o som volta quando o anúncio termina.
• Abra canais direto na aba Vídeos.

TAMBÉM
• Um único botão desliga tudo.
• Busca em todas as configurações.
• Aparência clara, escura ou automática.
• English, Türkçe, Deutsch, Español, Français, हिन्दी, 日本語, Português (Brasil).

PRIVACIDADE
Nenhum dado é coletado ou enviado. As configurações ficam no seu navegador.
```

### Uzun açıklama (日本語)

```
Open Youtube 設定は、YouTube にあったらいいのにと思う操作を、YouTube のプレーヤーそのものに追加します。

チャンネルのブロック
• おすすめ動画にカーソルを合わせて 🚫 を押すだけ。そのチャンネルの動画は、ホーム、検索結果、終了画面でまとめて隠れます。
• ブロックはポップアップからいつでも解除できます。

再生速度
• 現在の速度は YouTube の操作バーに表示されます。クリックするとプリセットや細かい刻みを選べます。
• すべての動画に既定の速度を設定するか、前の動画の速度を引き継げます。
• 速くする・遅くする・リセットを、自分で決めたキーボードショートカットで。

トリミング
• スクリーンショットを撮るように動画の範囲をドラッグ。再生は続き、プレーヤーに収めるか全体に広げて表示します。
• ワンクリックで動画全体の表示に戻ります。

クリップ
• 開始と終了を指定し、ループで確認して、動画ファイルとして保存できます。

色
• 明るさ、ブルーライトフィルター、色の反転。ショートカットでも調整できます。

もっと落ち着いた YouTube
• ショートを完全にオフ：棚、検索結果、メニュー項目、チャンネルのタブまで。
• ホームフィード、サイドバー、再生リストを非表示に。
• おすすめに出てくるチャンネルをワンクリックでブロック。
• 広告を自動でミュート。広告が終わると音が戻ります。
• チャンネルを最初から「動画」タブで開きます。

そのほか
• スイッチひとつですべてオフ。
• すべての設定を検索。
• ライト、ダーク、自動の外観。
• English, Türkçe, Deutsch, Español, Français, हिन्दी, 日本語, Português (Brasil).

プライバシー
データの収集や送信は一切ありません。設定はブラウザの中に保存されます。
```

### Uzun açıklama (हिन्दी)

```
Open Youtube सेटिंग्स वे कंट्रोल सीधे YouTube के अपने प्लेयर में ले आता है, जिनकी कमी आपको YouTube में खलती है।

चैनल ब्लॉक करें
• किसी सुझाए गए वीडियो पर माउस ले जाएँ और 🚫 दबाएँ — उस चैनल के सभी वीडियो होम पेज, सर्च और एंड स्क्रीन पर ढक जाते हैं।
• पॉपअप से कभी भी अनब्लॉक करें।

स्पीड
• मौजूदा स्पीड YouTube के कंट्रोल बार में दिखती है — क्लिक करके तय स्पीड या बारीक चरण चुनें।
• हर वीडियो के लिए डिफ़ॉल्ट स्पीड, या पिछली स्पीड को अगले वीडियो में भी बनाए रखें।
• स्पीड बढ़ाने, घटाने और रीसेट करने के लिए अपने कीबोर्ड शॉर्टकट।

वीडियो क्रॉप
• स्क्रीनशॉट लेने की तरह वीडियो पर एक हिस्सा चुनें; वीडियो चलता रहता है और प्लेयर में फ़िट होता है या उसे पूरा भर देता है।
• एक क्लिक से पूरा वीडियो फिर से दिखता है।

क्लिप
• शुरुआत और अंत चुनें, लूप में देखें और वीडियो फ़ाइल के रूप में सेव करें।

रंग
• ब्राइटनेस, ब्लू लाइट फ़िल्टर और रंग उलटना, शॉर्टकट से भी एडजस्ट करें।

शांत YouTube
• Shorts पूरी तरह बंद करें — शेल्फ़, सर्च नतीजे, मेन्यू एंट्री और चैनल टैब।
• होम फ़ीड, साइडबार या प्लेलिस्ट छिपाएँ।
• सुझावों में आने वाले चैनल एक क्लिक में ब्लॉक करें।
• विज्ञापनों को अपने-आप म्यूट करें; विज्ञापन खत्म होते ही आवाज़ लौट आती है।
• चैनल सीधे उनके वीडियो टैब पर खोलें।

और भी
• एक स्विच से सब कुछ बंद करें।
• सभी सेटिंग्स में खोजें।
• लाइट, डार्क या ऑटोमैटिक थीम।
• English, Türkçe, Deutsch, Español, Français, हिन्दी, 日本語, Português (Brasil).

गोपनीयता
कोई डेटा इकट्ठा नहीं किया जाता और कहीं नहीं भेजा जाता। सेटिंग्स आपके ब्राउज़र में ही रहती हैं।
```
