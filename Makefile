
demo:
	ln -s ../address-typeahead.js example/address-typeahead.js || true
	open http://localhost:8000 && pushd ./example; python -m SimpleHTTPServer; popd
