.PHONY: deploy test
deploy:
	./deploy.sh
test:
	cd backend && npm test
