#!/bin/bash

cp systemd-FoodDispenserServer.service /etc/systemd/system/FoodDispenserServer.service
systemctl enable FoodDispenserServer.service
systemctl start FoodDispenserServer.service
