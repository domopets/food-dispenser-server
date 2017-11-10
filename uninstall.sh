#!/bin/bash

systemctl stop FoodDispenserServer.service
systemctl disable FoodDispenserServer.service
rm /etc/systemd/system/FoodDispenserServer.service
