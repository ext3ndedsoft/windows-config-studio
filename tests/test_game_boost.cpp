#include <iostream>
#include <string>
#include <vector>
#include <set>
#include <algorithm>
#include <cassert>
#include <cctype>
#include "third_party/json.hpp"

static std::string ToLower(std::string s) {
    for (char& c : s) {
        if (c >= 'A' && c <= 'Z') c = (char)(c + 32);
    }
    return s;
}

static std::string Trim(const std::string& str) {
    size_t first = str.find_first_not_of(" \t\r\n");
    if (first == std::string::npos) return "";
    size_t last = str.find_last_not_of(" \t\r\n");
    return str.substr(first, (last - first + 1));
}

static std::string CleanGameTitle(const std::string& input) {
    std::string s = input;
    size_t dot = s.rfind(".exe");
    if (dot != std::string::npos) s = s.substr(0, dot);

    std::string spaced;
    for (size_t i = 0; i < s.size(); ++i) {
        if (i > 0 && isupper((unsigned char)s[i]) && (islower((unsigned char)s[i-1]) || (i + 1 < s.size() && islower((unsigned char)s[i+1])))) {
            spaced += ' ';
        }
        spaced += s[i];
    }
    s = ToLower(spaced);

    static const std::vector<std::string> suffixes = {
        "-win64-shipping", "_win64_shipping", "_dx12", "-dx12",
        "_x64", "-x64", "_release", "-release", "_be", "client", "launcher",
        "64", "32"
    };
    for (const auto& suf : suffixes) {
        if (s.size() > suf.size() && s.rfind(suf) == s.size() - suf.size()) {
            s.erase(s.size() - suf.size());
        }
    }
    for (char& c : s) {
        if (c == '_' || c == '-') c = ' ';
    }
    return Trim(s);
}

static std::string SanitizeCacheKey(const std::string& input) {
    std::string out;
    for (char c : input) {
        if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9')) {
            out += (char)std::tolower((unsigned char)c);
        } else if (c == ' ' || c == '_' || c == '-') {
            if (out.empty() || out.back() != '_') {
                out += '_';
            }
        }
    }
    while (!out.empty() && out.back() == '_') out.pop_back();
    return out.empty() ? "game" : out;
}

static std::string GetCoverForGame(const std::string& nameOrFolder, const std::string& displayName = "", const std::string& exeName = "") {
    std::string s = ToLower(nameOrFolder + " " + displayName + " " + exeName);

    // Exact matches and specific games first
    if (s.find("gta_sa") != std::string::npos || s.find("san andreas") != std::string::npos || s.find("arizona") != std::string::npos) return "/covers/gta_sa.jpg";
    if (s.find("wallpaper") != std::string::npos) return "/covers/wallpaper_engine.jpg";
    if (s.find("rv there yet") != std::string::npos || s.find("rv_there_yet") != std::string::npos || s.find("ride") != std::string::npos) return "/covers/rv_there_yet.jpg";
    if (s.find("apex") != std::string::npos) return "/covers/apex.jpg";
    if (s.find("cs2") != std::string::npos || s.find("counter-strike") != std::string::npos || s.find("csgo") != std::string::npos) return "/covers/cs2.jpg";
    if (s.find("gta") != std::string::npos || s.find("grand theft auto") != std::string::npos) return "/covers/gta5.jpg";
    return "/covers/default_game.jpg";
}

int main() {
    std::cout << "[TEST] Running Game Boost test suite...\n";

    // Test 1: Deduplication logic
    std::set<std::string> addedExes;
    std::vector<std::string> detectedGames;

    auto tryAddGame = [&](const std::string& exe, const std::string& id) -> bool {
        std::string exeLower = ToLower(exe);
        if (!exeLower.empty() && addedExes.count(exeLower)) {
            return false; // deduplicated!
        }
        addedExes.insert(exeLower);
        detectedGames.push_back(id);
        return true;
    };

    bool firstGta = tryAddGame("gta5.exe", "gta5");
    assert(firstGta == true);
    bool secondGta = tryAddGame("GTA5.exe", "gta5_secondary");
    assert(secondGta == false); // Must be rejected
    assert(detectedGames.size() == 1);
    std::cout << "  [PASS] Test 1: Deduplication prevents duplicate gta5.exe\n";

    // Test 2: Cover art matching
    std::string coverSa = GetCoverForGame("Grand Theft Auto San Andreas", "Arizona RP", "gta_sa.exe");
    assert(coverSa == "/covers/gta_sa.jpg");

    std::string coverGta5 = GetCoverForGame("Grand Theft Auto V", "GTA V", "gta5.exe");
    assert(coverGta5 == "/covers/gta5.jpg");

    std::string coverWallpaper = GetCoverForGame("wallpaper_engine", "Wallpaper Engine", "wallpaper64.exe");
    assert(coverWallpaper == "/covers/wallpaper_engine.jpg");

    std::string coverApex = GetCoverForGame("Apex Legends", "Apex Legends", "r5apex_dx12.exe");
    assert(coverApex == "/covers/apex.jpg");
    std::cout << "  [PASS] Test 2: Cover art matching prioritizes gta_sa.jpg, wallpaper_engine.jpg, apex.jpg\n";

    // Test 3: Title cleaning and Cache key sanitization
    std::string cleanApex = CleanGameTitle("r5apex_dx12.exe");
    std::string keyApex = SanitizeCacheKey(cleanApex);
    assert(keyApex == "r5apex");

    std::string cleanWallpaper = CleanGameTitle("Wallpaper Engine");
    std::string keyWallpaper = SanitizeCacheKey(cleanWallpaper);
    assert(keyWallpaper == "wallpaper_engine");

    std::string cleanWukong = CleanGameTitle("BlackMythWukong.exe");
    assert(cleanWukong == "black myth wukong");

    std::string cleanWp64 = CleanGameTitle("wallpaper64.exe");
    assert(cleanWp64 == "wallpaper");
    std::cout << "  [PASS] Test 3: Title cleaner (CamelCase + suffixes + 64/32) and cache key sanitization work\n";

    // Test 4: Ignored games filtering (exact matching, no substring bug)
    std::vector<std::string> ignoredList = { "game", "wallpaper64.exe" };
    auto isGameIgnored = [&](const std::string& id, const std::string& exe, const std::string& name) -> bool {
        std::string idL = ToLower(Trim(id));
        std::string exeL = ToLower(Trim(exe));
        std::string nameL = ToLower(Trim(name));
        for (const auto& ig : ignoredList) {
            std::string igl = ToLower(Trim(ig));
            if (igl.empty()) continue;
            if (idL == igl || exeL == igl || nameL == igl) return true;
            if (exeL == igl + ".exe" || igl == exeL + ".exe") return true;
        }
        return false;
    };

    assert(isGameIgnored("game", "game.exe", "Game") == true);
    assert(isGameIgnored("wallpaper_engine", "wallpaper64.exe", "Wallpaper Engine") == true);
    // Crucial: ignoring "game" MUST NOT ignore "game_cyberpunk"!
    assert(isGameIgnored("game_cyberpunk", "cyberpunk2077.exe", "Cyberpunk 2077") == false);
    assert(isGameIgnored("cs2", "cs2.exe", "Counter-Strike 2") == false);
    std::cout << "  [PASS] Test 4: Ignored / hidden games filtering (exact matching protects all games)\n";

    std::cout << "[SUCCESS] All unit verification checks passed!\n";
    return 0;
}
