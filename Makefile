all: test

test: deps
	runtests build

deps: build 
	npm install . --prefix=build

build:
	mkdir build

package:
	npm pack .

clean:
	 rm -rf reports
	 rm -rf build

.PHONY: all test deps clean 
