use app_lib::oauth::token::{TokenConfig, TokenStore};

const TEST_CONFIG: TokenConfig = TokenConfig {
    service_name: "VaporGit Test",
    keyring_user: "codex-oauth-token-test",
    file_name: "codex_oauth_token_test.txt",
};

#[test]
fn token_store_saves_loads_and_clears_token() {
    let store = TokenStore::new(TEST_CONFIG);
    store.clear().expect("clear existing token");

    store.save("test-token-value").expect("save token");
    assert_eq!(
        store.load().expect("load saved token"),
        Some("test-token-value".to_string())
    );

    store.clear().expect("clear token");
    assert_eq!(store.load().expect("load cleared token"), None);
}
