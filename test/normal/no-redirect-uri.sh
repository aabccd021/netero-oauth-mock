goto --url "http://localhost:3000\
?response_type=code\
&state=sfZavFFyK5PDKdkEtHoOZ5GdXZtY1SwCTsHzlh6gHm4\
&code_verifier=AWnuB2qLobencpDhxdlDb_yeTixrfG9SiKYOjwYrz4I\
&scope=openid\
&client_id=mock_client_id\
"

assert-response-code-equal 400
assert-equal 'Parameter redirect_uri is required.' "$(cat "$NETERO_STATE/browser/1/tab/1/body")"
