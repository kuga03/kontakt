package ru.kontakt.game;

import android.os.Bundle;
import android.view.View;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

// Полноэкранный immersive-sticky: шторка и кнопки навигации скрыты,
// игра на весь экран (свайп от края — временный показ системных панелей).
public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        hideSystemUI();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemUI();
    }

    private void hideSystemUI() {
        try {
            WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
            WindowInsetsControllerCompat c =
                WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
            if (c != null) {
                c.hide(WindowInsetsCompat.Type.systemBars());
                c.setSystemBarsBehavior(
                    WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                return;
            }
        } catch (Exception ignored) {}
        // Запасной путь для старых API.
        try {
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        } catch (Exception ignored) {}
    }
}
