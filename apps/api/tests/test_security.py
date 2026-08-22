from app.security import sanitize_filename


def test_filename_sanitization_removes_paths_and_shell_characters():
    assert sanitize_filename("../../a;$(touch x).PDF") == "a_touch_x_.PDF"
    assert sanitize_filename("   ") == "document.pdf"
