# 📺 IPTV Playlist

Auto-updated IPTV playlist — refreshed every day via GitHub Actions.

## 📡 Playlist URL

Full Link
```
https://gist.githubusercontent.com/ZeiTeria/68851fb02bbb95525d89ff0ff0afceae/raw/playlist.m3u
```
Short Link
```
https://rebrand.ly/IPTVZei
```

## 📦 Channels Included

### 🌍 Countries
| Flag | Country |
|------|---------|
| 🇮🇩 | Indonesia |
| 🇨🇳 | China |
| 🇹🇼 | Taiwan |
| 🇭🇰 | Hong Kong |
| 🇸🇬 | Singapore |
| 🇲🇾 | Malaysia |
| 🇲🇴 | Macau |
| 🇯🇵 | Japan |
| 🇰🇷 | Korea |
| 🇦🇺 | Australia |
| 🇺🇸 | USA |
| 🌏 | Chinese (All Regions) |

### 📺 Platforms
- Pluto TV, Plex TV
- Samsung TV Plus, LG Channels
- XUMO, Roku Channel
- Xiaomi TV+, Vizio TV
- DistroTV, Free-TV

### 🎬 Movies
- Tubi TV, Redbox
- Public Domain Movies

## 🔄 Auto-Update

Playlist is automatically updated every day at midnight UTC via GitHub Actions.
Dead streams and geo-blocked channels are filtered out automatically.

## 🛠 Manual Update

```bash
npm install
node index.js --skip-test   # fast, no stream testing
node index.js               # full test, removes dead streams
```

## 📱 How to Use

Add the playlist URL to any IPTV player:
- **VLC** → Media → Open Network Stream
- **TiviMate** → Add Playlist → M3U URL
- **IPTV Smarters** → Add User → M3U URL
- **GSE Smart IPTV** → Remote Playlists → Add